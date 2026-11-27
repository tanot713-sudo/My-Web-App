# แผนพัฒนาหน้าเรียนภาษาต่างประเทศ (`languages.html`) — design of record

เขียน 2026-11-26 (session `claude/eloquent-planck-lp6c9l`) จากคำขอเจ้าของ: "ไปดูส่วนเรียนภาษาว่าควรพัฒนาต่ออย่างไร + ใช้ repo/ข้อมูลจากเน็ต/Hugging Face ช่วย" · เขียนละเอียดไว้ให้ session/บัญชี Claude อื่นทำต่อได้ทันที

**วิธีใช้ไฟล์นี้**: เริ่มด้วย skill `tanot-session` → แถว 21–29 ของตาราง "งานถัดไป" ใน `ROADMAP.md` ชี้มาที่หัวข้อของไฟล์นี้ (L0–L8) → อ่านหัวข้อ "สภาพปัจจุบัน" + "ข้อบังคับ" ก่อนทุกงาน → ทำงานทีละแถว แถวละ branch/PR · ทำเสร็จแก้สถานะในตาราง ROADMAP (ไม่ต้องแก้ไฟล์นี้ เว้นแต่การออกแบบเปลี่ยน — ถ้าเปลี่ยน เขียนเหตุผลต่อท้ายหัวข้อนั้น)

---

## 1. สภาพปัจจุบัน (ตรวจจากโค้ดจริง 2026-11-26)

### ไฟล์
- `languages.html` (84 บรรทัด แต่ ~627 KB) — ข้อมูลอยู่ใน `<script type="application/json">` 33 ก้อน: `lang-data` (ภาษา + วลี), `vocab-data` (คำศัพท์), `hsk-data`, `*-script-data` (ตัวอักษรรายภาษา), `*-stroke-path-data` (ลำดับเส้น), `vn-tone-data`
- `languages.jsx` (17,783 บรรทัด ~1.68 MB) → `languages.compiled.js` (~1.71 MB) ด้วย `./build-react.sh` — **esbuild รันแบบไม่มี `--bundle`** จึง `import` ไฟล์ .jsx อื่นไม่ได้: UI ใหม่ต้องอยู่ใน `languages.jsx` · ตรรกะล้วนใหม่ให้แยกเป็นไฟล์ UMD (เช่น `lang-calc.js`) โหลดด้วย `<script>` ก่อน `languages.compiled.js` (แบบ `fsrs.js`/`learn-core.js`)
- script ใน head: `vendor/react/*`, `vendor/lucide`, Tesseract.js + hanzi-writer จาก jsDelivr (ใช้เฉพาะโหมดลายมือ) · ท้าย body: `file-reader.js`, `fsrs.js`, `learn-core.js`, `languages.compiled.js`
- เทสต์ที่มี: `tests/languages-ai.spec.js` (AI คลาวด์ของโหมดเขียน), `tests/lang-round2.spec.js` (บางส่วน), `smoke.spec.js`, `theme-audit.spec.js`, `learn.spec.js` (XP/legacy) · `repo-guards.mjs` ตรวจว่า compiled ตรงกับ .jsx

### 18 ภาษา (`LANGS`, id → `code`)
`lang-en en` · `lang-jp ja` · `lang-cn zh` · `lang-yue` (กวางตุ้ง) · `lang-kr ko` · `lang-de de` · `lang-in` (ฮินดี) · `lang-fr fr` · `lang-it it` · `lang-mm` (พม่า) · `lang-kh` (เขมร) · `lang-la` (ลาว) · `lang-vn vi` · `lang-my` (มลายู) · `lang-ar ar` · `lang-es es` · `lang-pt pt` · `lang-ru ru`

### ปริมาณเนื้อหา (จุดอ่อนหลัก)
| ข้อมูล | ต่อภาษา |
|---|---|
| วลี (`lang-data.phrases`) | 8 หมวด × 4 = **32 ประโยค** ทุกภาษา (`{target, thai}`) |
| คำศัพท์ (`vocab-data`) | ~**186 คำ** (9 หมวดพื้นฐาน ~10–22 คำ + กฎหมาย/วิศวกรรม/ธุรกิจ หมวดละ 20) · อังกฤษ 316 · จีน: เฉพาะทาง 180 + HSK1–3 600 (`hsk-data`) |
| ข้อสอบ | `<Xx>ExamView` แยกรายภาษา (HSK/TOEIC-like/JLPT-like ฯลฯ) — ข้อสอบฝังในโค้ด |

### โหมดที่มีแล้ว
ฝึกเขียนตัวอักษร + ลำดับเส้น (หลายอักษร) · การ์ดคำ / พิมพ์คำแปล / ฟังแล้วพิมพ์ (`SpellDiff`) · แต่งประโยค + AI ตรวจ (คลาวด์ `AiClient` → ถอยไป `ai-chat-worker.js` ถ้าไม่ใช่ iOS, แถว 19) · ฟัง (`ListeningPanel`) · พูดตาม (`ShadowingPanel` — อัดเสียง → `asr-worker.js` Whisper ในเครื่อง) · อ่าน (`ReadingPanel`) · ตัวเลข/วันที่ (`NumbersDatesPanel`) · ข้อสอบ · ลายมือ (Tesseract)

### เสียง
`speechSynthesis` ของเครื่อง (ฟังก์ชันรอบบรรทัด 570–640) + `TtsFallbackToast` เมื่อไม่มีเสียงภาษานั้น — iPhone/Windows หลายเครื่องไม่มีเสียงเขมร/ลาว/พม่า/มลายู/ฮินดี

### คีย์และการ์ด
- `lang-practice:srs` (sync **map**, 1 การ์ด = 1 property) · `progress`, `notes`, `wrong` (sync map) · `writing`, `xp`, `streak` (ตก prefix `lang-practice:` = sync blob) — ดู `data-registry.js` บรรทัด ~148–165
- **คีย์การ์ดอิงดัชนี**: `${langId}::vocab-${หมวด}::${idx}`, จีน `lang-cn::script::${i}` / `lang-cn::hsk1::${i}` → **ห้ามแทรก/ลบ/เรียงคำในหมวดเดิม** (การ์ดเดิมจะชี้ผิดคำ) เพิ่มได้เฉพาะต่อท้าย · เนื้อหาใหม่ต้องใช้ namespace ใหม่ที่ id ไม่อิงตำแหน่ง (ดู L1)
- `review.html` แสดงการ์ดภาษาจาก `tanot:learn:faces:lang` (cache, `writeCardFaces(srs)` ใน jsx สร้างจาก `vocabPool(langId)`) — การ์ดที่ไม่อยู่ใน `vocabPool` จะไม่มีหน้าการ์ดใน review → เนื้อหาใหม่ต้องเขียนหน้าการ์ดลง faces ด้วย
- XP: `LearnCore.award('lang', xp)` ก่อนเขียน `lang-practice:xp` (ตัวนับเดิมซ่อนแล้ว แถว 8)

---

## 2. ผลสำรวจแหล่งภายนอก

### repo ที่เจ้าของส่งมา (อ่าน README 2026-11-26)
| repo | คืออะไร | license | เอามาใช้ |
|---|---|---|---|
| hikariming/openkoto | เรียนจากข้อความ/EPUB/PDF/ซับไตเติลของตัวเอง: แตะคำ → AI อธิบาย, SRS, วนฟังซับทีละประโยค + shadowing | Apache-2.0 | แนวคิด L3 + L4 (โค้ดใช้ได้ถ้าใส่ที่มา แต่ stack เป็น Tauri/TS — เขียนเองง่ายกว่า) |
| ArtCC/freelingo | หลักสูตร CEFR A1–C2, ข้อสอบวัดระดับ, แผน 4–16 สัปดาห์, SM-2, role-play 50 ฉาก, เกม Error Detective / Sentence Order / Vocabulary Pairs, Kokoro TTS + faster-whisper | **AGPL-3.0** | **แนวคิดเท่านั้น ห้ามคัดลอกโค้ด** (copyleft) → L2, L5, L7 |
| IgnacioLD/awesome-language-learning | รายการลิงก์ (Anki, Forvo, Clozemaster, YouGlish, FSI, 50Languages, Easy Languages) | CC0 | แนวคิด cloze (L2) · ไม่มีข้อมูลดึงตรง |
| melling/LanguageLearning | ลิงก์รวม (Reddit/HN/บล็อก), โครงสร้างไฟล์ Anki | CC0 | ต่ำ |
| topics languagelearning / english-learning | earthworm (พิมพ์ประโยค+ฟังเขียน+FSRS ≈ ที่เรามี), qwerty-learner, read-frog, word-atlas (IELTS 7,298 คำ CC BY 4.0 อังกฤษล้วน), Echo-Loop (ฟังเข้มข้น) | หลากหลาย | ยืนยันแนว L1/L4 · word-atlas เป็นตัวเลือกเสริมของอังกฤษ |

ไม่มี repo ไหนมีเนื้อหาสำหรับผู้เรียนคนไทย

### ข้อมูลเปิด / โมเดล (ตรวจ license ใน L0 เมื่อ 2026-11-26 — คอลัมน์ "สถานะ" บอกว่าเปิดยืนยันจากหน้าจริงได้หรือไม่)
| แหล่ง | ใช้ทำอะไร | license | สถานะ |
|---|---|---|---|
| Tatoeba (`downloads.tatoeba.org` — `sentences.csv`, `links.csv`, `sentences_with_audio.csv`, `tags`) | ประโยคตัวอย่าง + คู่แปล (ไทยมีน้อย → อังกฤษเป็นตัวกลาง) | ข้อความ **CC BY 2.0 FR** (บางส่วน CC0 1.0; ประโยคญี่ปุ่น/อังกฤษส่วนหนึ่งมาจาก Tanaka Corpus = สาธารณสมบัติ) · เสียง = license ตามผู้อัดแต่ละคน ช่อง license ว่าง = ห้ามใช้นอก Tatoeba (สคริปต์ใช้ธงเสียงเฉพาะ CC BY/BY-SA/CC0) | ✅ ยืนยันจาก [tatoeba.org/en/downloads](https://tatoeba.org/en/downloads) 2026-11-26: "These files are released under CC BY 2.0 FR. A part of our sentences are also available under CC0 1.0." · รูปแบบไฟล์ตรงกับที่สคริปต์อ่านแล้ว (ตรวจกับไฟล์จริง: sentences `id⇥lang⇥text`, links `id⇥id`, audio `id⇥audio id⇥user⇥license⇥url`) |
| hermitdave/FrequencyWords (นับจาก OpenSubtitles 2018) | อันดับความถี่คำ | โค้ด MIT · ข้อมูล **CC-by-sa-4.0** | ✅ ยืนยันจาก README + LICENSE ของ repo ([github.com/hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords#license), 2026-11-26): "MIT License for code. CC-by-sa-4.0 for content." · มีไฟล์ 50k ของ en zh_cn ko de fr it vi ms id ar es pt ru th (2018) และ ja hi (2016) · **ไม่มี**: yue, พม่า (my), เขมร (km), ลาว (lo) → ไม่มีชุดใหม่ของภาษาเหล่านี้จนกว่าจะมีแหล่งอื่นที่ license ตรวจแล้ว |
| kaikki.org (Wiktionary ที่แยกเป็น JSON) | คำแปลไทยของคำ (ช่อง `translations`), IPA, gloss | เนื้อหา Wiktionary = CC BY-SA 4.0 + GFDL (ตามความรู้) · โค้ด Wiktextract = MIT (ยืนยันจาก README ของ tatuylonen/wiktextract) | ⚠️ **ยืนยันครึ่งเดียว** (2026-11-26): หน้า kaikki.org (`/index.html`, `/dictionary/rawdata.html`) **ไม่ระบุ license ของข้อมูล** และ `en.wiktionary.org/wiki/Wiktionary:Copyrights` เปิดไม่ได้ใน sandbox (403) · ใช้แบบ CC BY-SA 4.0 (ต้องระบุที่มา + แชร์ต่อแบบเดียวกัน — ลงใน credits.html แล้ว) · เจ้าของควรเปิดหน้า Copyrights ของ Wiktionary ยืนยันเอง · ข้อมูลที่ใช้: en.wiktionary dump 2026-10-01 |
| CC-CEDICT | จีน (มีใช้อยู่แล้วตรวจ pinyin) | CC BY-SA 4.0 | ⚠️ ยังไม่ได้ตรวจ (ไม่อยู่ในขอบเขต L0) |
| JMdict | ญี่ปุ่น | CC BY-SA 4.0 (EDRDG) | ⚠️ ยังไม่ได้ตรวจ (ไม่อยู่ในขอบเขต L0) |
| Kokoro-82M (`onnx-community/Kokoro-82M-v1.0-ONNX`, ไลบรารี kokoro-js) | TTS คุณภาพสูงในเบราว์เซอร์: en, ja, zh, es, fr, hi, it, pt | Apache-2.0 | ⚠️ ยังไม่ได้ตรวจ (ไม่อยู่ในขอบเขต L0) |
| Meta MMS-TTS (`facebook/mms-tts-khm`, `-lao`, `-mya`, `-zlm`/`-msa`, `-hin`, `-vie` …) | TTS ภาษาที่เครื่องไม่มีเสียง (ใช้ transformers.js ที่ vendor ไว้แล้ว) | **CC BY-NC 4.0** (เว็บส่วนตัวใช้ได้ ห้ามเชิงพาณิชย์) · บางรุ่นต้อง uroman (ตรวจทีละภาษา) | ⚠️ ยังไม่ได้ตรวจ (ไม่อยู่ในขอบเขต L0) |
| Whisper (`Xenova/whisper-*`, มีอยู่แล้ว) | ถอดเสียงพูดตาม | MIT | ⚠️ ยังไม่ได้ตรวจ (ไม่อยู่ในขอบเขต L0) |
| `facebook/wav2vec2-xlsr-53-espeak-cv-ft` | รู้จำหน่วยเสียง (IPA) → ให้คะแนนออกเสียง (ทดลอง) | Apache-2.0 | ⚠️ ยังไม่ได้ตรวจ (ไม่อยู่ในขอบเขต L0) |
| Oxford 3000/5000, รายการ CEFR เชิงพาณิชย์ | — | **ห้ามใช้** (ลิขสิทธิ์) — ใช้ระดับจากความถี่แทน | ⚠️ ยังไม่ได้ตรวจ (ไม่อยู่ในขอบเขต L0) |

---

## 3. ข้อบังคับที่ทุกงานต้องทำตาม (สรุปจาก CLAUDE.md)
- ตรรกะล้วน (parse ซับไตเติล, คิดระดับ, ให้คะแนน, เลือกโจทย์) อยู่ใน `lang-calc.js` (UMD `window.LangCalc`, ไม่มี DOM/storage, `require()` ได้) + known-answer test ใน `tests/languages-<งาน>.spec.js` (เขียนเทสต์ที่ล้มก่อน — `test-driven-development`)
- แก้ `languages.jsx`/`.html` → `./build-react.sh` แล้ว commit `languages.compiled.js` + `react-pages.css` คู่กัน · ไฟล์ JS/HTML ใหม่ → `sw.js` PRECACHE (ถ้าต้องใช้ออฟไลน์) + bump `CACHE`
- คีย์ใหม่ลงทะเบียนใน `data-registry.js` **เหนือ** `{ prefix: 'lang-practice:' }` และ `{prefix:'tanot:'}` · ห้ามเปลี่ยนรูปแบบคีย์เดิม · list/map เขียนแบบ อ่านสด→แก้→เขียน
- ข้อความ UI ผ่าน `OME_I18N`/`tx()` ไทย+อังกฤษ · เนื้อหาบทเรียน/ประโยคภาษาเป้าหมาย/ข้อมูลผู้ใช้ = `data-i18n-skip`
- **กฎ no-explainer**: ไม่มีคำอธิบายวิธีใช้/คำโปรยในหน้า · ข้อความสถานะที่เกิดจากการกระทำจริงได้
- คอมโพเนนต์กลาง `theme.css` + Tailwind ที่ผูก token (ห้ามสี hex ใหม่) · โหลด `tanot-design` ก่อนแตะ UI · ตรวจ `theme-audit.spec.js` ไม่แย่ลง
- AI: `AiClient` โมเดล `main`/`fast` (Workers AI ฟรี) เท่านั้น · **ห้ามเรียก `/api/ocr`/Claude** จากหน้านี้ · ไม่มีคลาวด์ + ไม่ใช่ iOS → ถอยไป `ai-chat-worker.js` (แบบแถว 19) · iOS แสดง `AiClient.friendlyMessage`
- ไลบรารี/ข้อมูล/โมเดลภายนอกใหม่ → การ์ดใน `credits.html` (ข้อมูล CC BY/BY-SA ต้องระบุที่มา + license ในการ์ด) · ไลบรารี runtime ใหม่ vendor ไว้ใน `vendor/` ไม่โหลดจาก CDN
- โมเดลในเบราว์เซอร์: โหลดผ่าน `TanotMedia.budget` (มือถือทีละโมเดล), แคช `transformers-cache`, error ลง `TanotMedia.logError` โดย**ไม่มีเนื้อหาผู้ใช้** · โมเดลของ `Tanotfin/*` เท่านั้นที่ต้องผ่าน `/api/hf/` (โมเดล public อื่นโหลดตรง) · repo-guards `tanotfin-models` ห้ามเพิ่มโมเดล Tanotfin ใหม่โดยไม่แก้ guard (ต้องถามเจ้าของ)
- ไฟล์ผู้ใช้ (ซับไตเติล/วิดีโอ/ข้อความที่วาง) **อยู่ในเครื่องเท่านั้น** ไม่อัปโหลด ไม่ซิงก์ (เว้นแต่เจ้าของสั่ง)
- ขนาด: `languages.compiled.js` ใหญ่แล้ว — ข้อมูลใหม่ห้ามฝังใน `.html`/`.jsx` ให้เป็นไฟล์ JSON แยกโหลดตอนใช้ (L1)

---

## 4. งาน (เรียงตามลำดับที่แนะนำ)

### L0 — ยืนยัน license + สคริปต์สร้างชุดข้อมูล (ROADMAP แถว 21)
**เป้า**: เครื่องมือ owner-run ที่สร้างไฟล์ชุดข้อมูลต่อภาษาจากแหล่งเปิด ทำซ้ำได้ ล็อกเวอร์ชันแหล่ง
1. เปิดหน้า license จริงของ Tatoeba, FrequencyWords, kaikki.org (และ CC-CEDICT/JMdict ถ้าใช้) บันทึกผลในตาราง §2 (แก้ ⚠️ เป็น ✅ + ลิงก์ + วันที่) · แหล่งไหน license ไม่ชัด = ไม่ใช้
2. `tools/lang-data/` (แบบ `tools/media-eval`, ไม่รันใน CI, ไม่มี root package.json): `build.mjs` (Node ล้วน, ไม่มี dependency หรือ dependency ใน `tests/package.json`) + `README.md` (ขั้นตอนดาวน์โหลดไฟล์ดิบเอง — sandbox อาจเข้าเน็ตไม่ได้ ให้เจ้าของรันบนเครื่อง/Colab)
3. ผลลัพธ์ `lang-packs/<code>-<hash8>.json.gz` (hash ของ JSON ก่อนบีบ = เปลี่ยนเนื้อแล้วชื่อเปลี่ยน ไม่ต้องพึ่ง bump CACHE) + `lang-packs/index.json` (ไม่บีบ): `{v:1, packs:{"lang-en":{file, words, sentences, bytes (gz), raw (ก่อนบีบ), sources:[…]}}}` · บีบด้วย zlib ระดับ 9, mtime = 0 และ OS byte = 3 → build ซ้ำได้ไบต์เดิม · **หน้าเว็บ (L1) แตกด้วย `DecompressionStream('gzip')`** (ต้องรองรับ: Chrome 80+, Safari 16.4+, Firefox 113+; ไม่รองรับ = บอกผู้ใช้ ไม่ถอยเงียบๆ)
4. รูปแบบไฟล์ v2 (ย่อให้เล็ก: **ช่องที่ว่างไม่เขียน**):
   ```json
   { "v": 2, "lang": "lang-en", "src": {"freq": "FrequencyWords@<commit>", "tatoeba": "<วันที่ดาวน์โหลด>", "wikt": "kaikki <วันที่>"},
     "w": [ {"id": "you", "r": 1, "th": "คุณ", "ipa": "/ju/"}, {"id": "the", "r": 3, "g": "Used before a noun phrase", "ipa": "/ðə/"} ],
     "s": [ {"id": 1329, "t": "Hurry up.", "th": "เร็วเข้า", "lv": 2, "au": 1} ] }
   ```
   - `w.id` = คำในรูป NFC ตัวพิมพ์เล็ก (ไม่มี `::`) · `r` อันดับความถี่ · **ไม่มีช่อง `lv` ของคำ** — คิดจาก `r` ด้วย `LEVEL_BANDS` (≤500=1, ≤1200=2, ≤2500=3, ≤5000=4, ≤8000=5, อื่น=6; ค่าที่เดียวใน `LangCalc.LEVEL_BANDS` + `tools/lang-data/lib.js` ต้องตรงกัน) · `th` คำแปลไทย (ไม่มี = ไม่มีช่อง) · `g` gloss อังกฤษ เขียนเฉพาะเมื่อไม่มี `th` (ให้หน้าเว็บแปลไทยตอนใช้) · `ipa` ไม่มี = ไม่มีช่อง
   - `s.id` = id ประโยคของ Tatoeba (ถาวร) · `t` ประโยคภาษาเป้าหมาย · `th` ถ้ามีลิงก์ไทยใน Tatoeba · `en` คำแปลอังกฤษ (ตัวกลาง; **ภาษาอังกฤษไม่เขียน `en` เพราะ = `t`**; ภาษาอื่นไม่มี `en` = ไม่มีคำแปลอังกฤษ) · `lv` = ระดับของคำที่ยากที่สุดในประโยค · `au:1` เมื่อ Tatoeba มีเสียงที่ license อนุญาต (ไม่มี = ไม่เขียน; ยังไม่ใช้เสียงใน L1) · **ไม่มีช่องรายการคำ `w`** — L1/L2 ตัดคำเองด้วยกฎเดียวกับ `tokenize` ของ `tools/lang-data/lib.js` (ละติน: `[\p{L}\p{M}]+(['’][\p{L}\p{M}]+)*` NFC ตัวพิมพ์เล็ก ไม่นับตัวเลข · ja/zh/yue/km/lo/my: `Intl.Segmenter(code,{granularity:'word'})` เฉพาะที่ `isWordLike`) แล้วย้ายเป็นฟังก์ชันใน `lang-calc.js` พร้อมเทสต์เทียบผลกับ lib.js
   - ประโยคยาว ≤ 12 คำ (ญี่ปุ่น/จีน/กวางตุ้ง ≤ 25 ตัวอักษร) · เพดานต่อภาษา: คำ 3,000 · ประโยค 3,000 · เป้าขนาด: ดูตัวเลขจริงใน ROADMAP แถว 21
   - กรองคำ: ตัดชื่อเฉพาะ/คำหยาบ (รายการตัดใน `tools/lang-data/stop/<code>.txt`), ตัดคำที่ไม่มีคำแปล/gloss เมื่อมี kaikki
5. คำแปลไทยที่ขาด: สคริปต์**ไม่**เรียก AI เอง (sandbox เข้า Workers AI ไม่ได้ และกันค่าใช้จ่ายซ่อน) → ช่องว่างไว้ แล้วหน้าเว็บแปลตอนใช้ (L1 ข้อ 5)
6. ภาษาที่แหล่งขาด (ลาว/เขมร/พม่า มีใน FrequencyWords น้อยหรือไม่มี; Tatoeba น้อยมาก): รายงานจำนวนที่ได้จริงใน README · ไม่มีข้อมูล = ไม่มีไฟล์ (หน้าไม่แสดงชุดใหม่ของภาษานั้น) ห้ามแต่งข้อมูลเอง
**ส่งมอบ**: สคริปต์ + README + ตาราง license ที่ยืนยันแล้ว + ไฟล์ตัวอย่าง 1 ภาษา (อังกฤษ) ถ้าดาวน์โหลดได้ · เจ้าของรันภาษาที่เหลือ (เพิ่มในแถว 0)

### L1 — ชุดคำศัพท์ตามความถี่ + ประโยคตัวอย่าง ในหน้า (แถว 22)
**เป้า**: ทุกโหมดที่มีอยู่ (การ์ดคำ / พิมพ์คำแปล / ฟังแล้วพิมพ์ / ทวน FSRS) ใช้ชุดใหม่ได้ เลือกตามระดับ
1. `lang-calc.js`: `packFile(index, langId)`, `cardKey(langId, kind, id)` → `lang-en::w::the` / `lang-en::s::1276` (**ไม่อิงดัชนี** — สร้างไฟล์ใหม่แล้วการ์ดเดิมยังตรง), `levelOf(rank)`, `pickNew(pack, srs, {level, n})` (คำใหม่ตามลำดับความถี่ที่ยังไม่มีการ์ด), `sentencesFor(pack, wordId, n)`, `toPoolItems(pack)` → `{key, word, thai, extra}` รูปเดียวกับ `vocabPool`
2. หน้า: ตัวเลือกแหล่ง "ชุดพื้นฐาน (เดิม) / คำที่ใช้บ่อย (ระดับ A1…C2)" ในโหมดคำศัพท์ (segmented) · โหลด `lang-packs/index.json` + ไฟล์ของภาษาด้วย `fetch` ครั้งแรกที่เลือก (spinner + error ข้อความ "โหลดไม่ได้ — ลองใหม่" ไม่ทำหน้าพัง) · เก็บในหน่วยความจำ ไม่ลง localStorage
2b. **รูปแบบไฟล์ v2 (จาก L0)**: ไฟล์เป็น `.json.gz` → แตกด้วย `DecompressionStream('gzip')` (ไม่รองรับ = ข้อความบอกผู้ใช้ ไม่ถอยเงียบๆ) · ไฟล์ไม่มี `lv` ของคำและไม่มี `w` ของประโยค: `levelOf(r)` ใช้ `LEVEL_BANDS` ชุดเดียวกับ `tools/lang-data/lib.js`, รายการคำของประโยคตัดด้วย `tokenize` ที่ย้ายมาไว้ใน `lang-calc.js` (เทสต์เทียบผลกับ lib.js) · `index.json` มี `bytes`/`raw` ใช้แสดงขนาดดาวน์โหลดได้
3. ออฟไลน์: `sw.js` cache-first ของ asset same-origin เก็บไฟล์ให้หลังใช้ครั้งแรกอยู่แล้ว — ตรวจด้วยเทสต์ว่าออฟไลน์เปิดซ้ำได้ · **ไม่ precache** (หลาย MB รวม) · `index.json` ใส่ PRECACHE ได้ (เล็ก)
4. review.html: เมื่อสร้าง/ให้คะแนนการ์ด `::w::`/`::s::` ต้องเขียนหน้าการ์ดลง faces — แก้ `writeCardFaces` ให้รวมรายการจาก pack ที่โหลดแล้ว + เก็บหน้าการ์ดของการ์ดชุดใหม่ใน**คีย์ใหม่** `lang-practice:faces` (sync map `{key: [word, thai]}`) เพราะ pack อาจยังไม่โหลดตอน `writeCardFaces` รัน และอีกเครื่องต้องเห็นหน้าการ์ด · `review.js` อ่าน `lang-practice:faces` เพิ่มจาก `tanot:learn:faces:lang` (TanotData.read) · ลงทะเบียน registry เหนือ prefix
5. คำแปลไทยที่ขาด: ปุ่ม "แปลไทย" ต่อการ์ด/ประโยค → `AiClient.summarize({task:'lang-th', model:'fast', messages})` ส่งทีละ ≤ 20 รายการ (D1 `ai_cache` ทำให้ซ้ำฟรี) → ผลเก็บใน `tanot:lang:th` (**cache** kind — สร้างใหม่ได้) และหน้าการ์ดที่สร้างแล้วใน `lang-practice:faces` · ป้าย "แปลโดย AI" เล็กๆ ข้างคำแปลที่มาจาก AI (เป็นสถานะ ไม่ใช่คำอธิบาย) · ไม่มีคลาวด์ = แสดงคำแปลอังกฤษ (`en`) แทน
6. ประโยคตัวอย่างใต้การ์ดคำ (≤ 3 ประโยคที่มีคำนั้น) + ปุ่มฟัง (`speechSynthesis` เดิม)
7. ชุดเดิม (`vocab-data`) ไม่แตะ — การ์ดเดิมใช้ต่อ
8. เทสต์ `tests/languages-packs.spec.js`: known-answer ของ `LangCalc` (คีย์, ระดับ, pickNew ข้ามการ์ดที่มี, ไม่เปลี่ยนเมื่อเรียงไฟล์ใหม่) + หน้าจริงกับ pack ปลอมใน `tests/fixtures/lang-pack-test.json` (route `lang-packs/*`) + ออฟไลน์ + review.html เห็นหน้าการ์ด + ซิงก์ 2 context ของ `lang-practice:faces` + `/api/ai/summarize` ปลอม (ห้ามมีคำขอ `/api/ocr`)
9. credits.html: Tatoeba, FrequencyWords, kaikki/Wiktionary (ตามที่ใช้จริง)

### L2 — เกมจากประโยค: เติมคำ / เรียงประโยค / จับคู่ (แถว 23)
แนวคิดจาก freelingo + Clozemaster (เขียนเอง ไม่คัดลอก)
- `LangCalc.cloze(sentence, wordId)` (ซ่อนคำ + ตัวเลือกหลอก 3 ตัวระดับใกล้กันจาก pack — สุ่มด้วย seed เพื่อเทสต์ได้), `scramble(sentence, seed)` (ตัดคำ: ภาษาเว้นวรรค = ช่องว่าง, ja/zh/yue/km/lo/my = `Intl.Segmenter(code,{granularity:'word'})` ไม่มี = ทีละตัวอักษร ≤ 12 ชิ้น), `checkOrder`, `pairs(pack, n, seed)`
- ผลถูก/ผิดของคำ → FSRS การ์ด `::w::` เดิม (rating 3/1) · XP `LearnCore.award('lang', 2)` ต่อข้อถูก
- โหมดใหม่อยู่ในกลุ่มโหมดคำศัพท์ (segmented/tabs กลาง) ใช้ pack จาก L1 → **ต้องทำ L1 ก่อน**
- เทสต์ known-answer + หน้า (คลิกเรียงครบ, คีย์บอร์ดได้, มือถือ 390px แตะ ≥ 40px)

### L3 — อ่านจากข้อความของตัวเอง (แถว 24)
แนวคิดจาก openkoto
1. แท็บ "อ่านจากข้อความ": วางข้อความ หรือนำเข้าไฟล์ (.txt/.docx/.pdf ผ่าน `TanotFileReader.readAnyFile(file, {ocr:false})` ที่โหลดอยู่แล้ว) · ข้อความอยู่ในหน่วยความจำ + ร่างล่าสุดใน `lang-practice:reader` (**local**, เก็บ ≤ 20,000 ตัวอักษร) ไม่ซิงก์
2. แสดงเป็นคำที่แตะได้ (ตัดคำแบบ L2) · ไฮไลต์สี: มีการ์ดแล้ว / อยู่ใน pack ระดับสูงกว่าผู้ใช้ / ไม่รู้จัก (สีจาก token `--ome-info-soft` ฯลฯ)
3. แตะคำ → กล่องข้าง (มือถือ = dialog ล่าง): คำแปลจาก pack ก่อน → ไม่มี = ปุ่ม "ถาม AI" (`AiClient.chat` `main`, prompt ขอ JSON `{lemma, th, pos, note}` ตอบภาษาไทย; parse ด้วย `LangCalc.parseLookup` ทนโค้ดบล็อก) → ปุ่ม "เพิ่มเป็นการ์ด"
4. การ์ดจากข้อความ: คีย์ `lang-xx::u::<lemma>` ใน `lang-practice:srs` เดิม + หน้าการ์ด (คำ, คำแปล, ประโยคที่เจอ ≤ 200 ตัวอักษร) ใน `lang-practice:faces` (L1) · ห้ามเก็บทั้งข้อความ
5. ปุ่ม "แปลประโยคนี้" (เลือกประโยค) → AI `fast`
6. เทสต์: ตัดคำ/parseLookup known-answer + หน้า (AI ปลอม, ไม่มีคำขออื่นนอก `/api/ai/*`, ข้อความไม่ไปอยู่ใน problem log/ซิงก์)

### L4 — วนฟังซับไตเติล + พูดตาม (แถว 25)
แนวคิดจาก openkoto/Echo-Loop
1. `LangCalc.parseSubs(text)` รองรับ SRT + WebVTT (เวลา `hh:mm:ss,mmm`/`.mmm`, ตัดแท็ก `<i>`/`{\an8}`, รวมบรรทัด) → `[{start,end,text}]` · ไฟล์ซับคู่ (ภาษาเป้าหมาย + ไทย) จับคู่ตามเวลาซ้อนทับ `pairSubs`
2. เลือกไฟล์เสียง/วิดีโอในเครื่อง (`URL.createObjectURL`, ไม่อัปโหลด) + ซับ → รายการประโยค · ปุ่ม: เล่นประโยคนี้, วนประโยค (A-B), ความเร็ว 0.75/1, ซ่อน/แสดงซับ, ก่อนหน้า/ถัดไป, คีย์ลัด ←/→/Space (ไม่ต้องมีข้อความอธิบายคีย์ลัด)
3. พูดตาม: อัดเสียง → ถอดด้วยทางเดียวกับ `ShadowingPanel` (asr-worker ในเครื่อง; คลาวด์ `AiClient.asr` เมื่อ available) → `SpellDiff` เทียบกับซับ + คะแนน `LangCalc.similarity` (ระยะ Levenshtein ระดับตัวอักษรหลังตัดวรรคตอน/ตัวพิมพ์)
4. ไม่มีซับ: ปุ่ม "สร้างซับด้วยการถอดเสียง" ใช้ `TanotMedia.transcribeLocalDetailed`/`TanotAsrCloud` (segments → ประโยค) — ทำเป็นขั้นที่ 2 ของงาน ถ้างานยาวเกินแยกแถว
5. ประโยคที่เลือก → การ์ด `::u::` แบบ L3 (ข้อความประโยคเป็นหน้าการ์ด ไม่เก็บเสียง)
6. เทสต์: parseSubs/pairSubs known-answer (SRT/VTT/BOM/CRLF/เวลาเพี้ยน) + หน้ากับไฟล์ WAV ที่สร้างในเทสต์ + asr ปลอม

### L5 — ฝึกสนทนาสวมบทบาทกับ AI (แถว 26)
แนวคิดจาก freelingo (role-play)
1. ฉาก = หมวดวลีเดิม 8 หมวด (ทักทาย, ร้านอาหาร, สัมภาษณ์งาน, ตม., เช่าบ้าน, ธนาคาร, ซื้อของ, โรงพยาบาล) + ระดับ (A1–B2) · ข้อมูลฉากอยู่ใน `lang-calc.js` `SCENES` (บทบาท AI, เป้าหมายของผู้เรียน)
2. `LangCalc.roleplayMessages(scene, level, langName, history)` → system prompt: ตอบเป็นภาษาเป้าหมายระดับนั้น ประโยคสั้น ≤ 2 ประโยค และต่อท้ายด้วยบล็อก JSON `{"fix": "...", "th": "..."}` (แก้ประโยคผู้เรียน + คำแปลไทยของคำตอบ AI) · `parseRoleplay` แยกข้อความกับ JSON (ไม่มี JSON = แสดงข้อความล้วน)
3. `AiClient.chat` (stream, `main`) · ไม่มีคลาวด์: ถอยไป `ai-chat-worker.js` แบบแถว 19 (ไม่ใช่ iOS) · ประวัติแชทอยู่ในหน่วยความจำ ไม่เก็บ
4. พิมพ์ หรือกดไมค์ (ถอดเสียงแบบ L4) · ปุ่มฟังคำตอบ (`speechSynthesis`/L6) · ปุ่มแสดงคำแปลไทย/คำแก้
5. จบฉาก (ผู้ใช้กด) → AI สรุปคำที่ควรจำ ≤ 5 คำ → เลือกเพิ่มเป็นการ์ด `::u::` · XP `LearnCore.award('lang', 10)` ต่อฉากที่จบ
6. เทสต์: prompt/parse known-answer + หน้ากับ `/api/ai/chat` SSE ปลอม + ไม่มี `/api/ocr`

### L6 — เสียงอ่านเมื่อเครื่องไม่มีเสียง (แถว 27)
1. `LangCalc`/`media-models.js`: ตาราง `LANG_TTS` ต่อภาษา: Kokoro (en/ja/zh/es/fr/hi/it/pt) และ MMS (`facebook/mms-tts-khm`, `-lao`, `-mya`, ภาษามลายู, …) · ใช้**เฉพาะเมื่อ** `speechSynthesis` ไม่มีเสียงของภาษานั้น หรือผู้ใช้เลือก "เสียงคุณภาพสูง" (ค่าเริ่มต้น = เสียงเครื่อง)
2. MMS: ใช้ `tts-worker.js` + transformers.js ที่ vendor ไว้ (แบบหน้า text-to-speech แต่โมเดลอื่น) — **ตรวจทีละภาษาว่าโมเดลต้อง uroman ไหม** (ถ้าต้อง = ข้ามภาษานั้น หรือทำ romanize เองเฉพาะเมื่อมีกฎชัด) · กรองตัวอักษรด้วย vocab ของโมเดล (อ่าน `tokenizer.json`/`vocab.json`) กัน ONNX พังแบบที่เคยเกิดกับเสียงไทย (ดู CLAUDE.md Section 4)
3. Kokoro: ต้อง vendor `kokoro-js` (+ phonemizer espeak-ng wasm ของมัน) ไว้ใน `vendor/kokoro/` ล็อกเวอร์ชัน · ใช้ onnxruntime-web ตัวที่ pin 1.24.3 ได้หรือไม่ต้องตรวจก่อน (ถ้าบังคับรุ่นอื่น = หยุดแล้วถามเจ้าของ เพราะ pin นั้นมีเหตุผล) · ถ้ายุ่งเกิน ทำ MMS อย่างเดียวก่อน
4. `TanotMedia.budget` (มือถือทีละโมเดล), แคช `transformers-cache`, error → ข้อความ + กลับไปเสียงเครื่อง (บอกผู้ใช้ ไม่เงียบ) + problem log ไม่มีข้อความ
5. credits.html: MMS (CC BY-NC 4.0) / Kokoro (Apache-2.0) / kokoro-js
6. เทสต์: route transformers ปลอม (แบบ `tts-voice.spec.js`) + ภาษาที่ไม่มีเสียงเครื่อง (`speechSynthesis.getVoices` จำลองว่าง) → ใช้โมเดล · มีเสียงเครื่อง → ไม่โหลดโมเดล
**ต้องตรวจเองหลัง deploy** (เพิ่มในแถว 0): ฟังเสียงจริงทีละภาษา + ชื่อไฟล์ ONNX ของแต่ละ repo (`tools/media-eval/check-models.mjs` เพิ่มรายการ)

### L7 — วัดระดับ + แผนเรียนรายวัน (แถว 28)
1. ข้อสอบวัดระดับแบบประมาณคลังคำ: สุ่มคำจากแต่ละแถบความถี่ (L0 `lv`) แถบละ 8 คำ ผู้ใช้ตอบ "รู้/ไม่รู้" + ข้อตรวจซ้ำ 4 ข้อแบบเลือกคำแปล (กันกดรู้ทุกข้อ) → `LangCalc.estimateLevel(answers)` → ระดับ A1–C2 + จำนวนคำโดยประมาณ (ไม่อ้างว่าเป็นผล CEFR ทางการ — แสดงเป็น "ระดับโดยประมาณ" สั้นๆ)
2. เก็บ `lang-practice:level` (sync map `{langId: {lv, words, at}}`) · ใช้เป็นค่าเริ่มต้นของตัวเลือกระดับใน L1/L2/L5
3. แผนรายวัน: คำใหม่/วัน (ค่าเริ่มต้น 10) + การ์ดถึงรอบ → การ์ดบนหน้าภาษา "วันนี้: ใหม่ n · ทวน m" ผูก `LearnCore` daily goal (ไม่สร้างระบบ XP ใหม่) · ตั้งค่าใน `lang-practice:plan` (sync map ต่อภาษา)
4. หน้าแรก: `home-calc.js` นับการ์ดภาษาถึงรอบอยู่แล้วผ่าน `LearnCore.dueCounts` — ไม่ต้องแก้ ยกเว้นการ์ด `::w::/::s::/::u::` ต้องนับ (ตรวจ `dueCounts.lang` อ่านทุกคีย์ใน srs หรือไม่)
5. ต้องทำ L1 ก่อน

### L8 — คะแนนการออกเสียง (ทดลอง) (แถว 29, พักไว้จนกว่า L4 เสร็จ)
ขั้น 1 (ถูก): คะแนนจากผลถอดเสียง Whisper เทียบประโยค (ได้จาก L4 แล้ว) · ขั้น 2: `wav2vec2-xlsr-53-espeak-cv-ft` ใน Worker → ลำดับหน่วยเสียง เทียบกับหน่วยเสียงอ้างอิง (ต้องมี espeak-ng wasm หรือ IPA จาก kaikki) → ไฮไลต์เสียงที่ผิด · โมเดล ~1.2 GB fp32 / ต้องหา quantized ONNX — ตรวจขนาด/ความเร็วจริงก่อน ถ้าเกิน ~300 MB หรือช้าบนคอมทั่วไป = ไม่ทำ · ต้องมีผลวัดบนเครื่องเจ้าของก่อนตัดสิน

### L9 — ภาพประกอบคำศัพท์ด้วย FLUX ของ Workers AI (แถว 31, เพิ่ม 2026-11-26 ตามที่เจ้าของเสนอ)
**ทำไมคุ้ม**: ภาพผูกกับ "ความหมาย" ไม่ใช่ภาษา → ภาพเดียวใช้ได้ทั้ง 18 ภาษา (คำว่า "แอปเปิล" ทุกภาษาใช้ภาพเดียวกัน)
**โควตา (คิดจาก `imageNeurons` ใน `functions/_lib/ai.js` — ค่าประมาณของเราเอง ยังไม่ได้เทียบบิลจริง)**: แบ่งจากกองฟรี 10,000 Neurons/วัน ร่วมกับแชท/ถอดเสียง · `fast` (flux-1-schnell, 1024² คงที่) ≈ 72/ภาพ → ~130 ภาพ/วัน ถ้าใช้หมดกอง · `quality` (flux-2-klein-4b) 512² ≈ 33/ภาพ → ~300 ภาพ/วัน · คำรูปธรรม ~1,000–1,500 ความหมาย = ทำทยอย 4–7 วัน
1. รายการความหมาย: คำรูปธรรมจาก `vocab-data` หมวดพื้นฐาน (ครอบครัว อาหาร เดินทาง บ้าน ร่างกาย ธรรมชาติ) + คำนามรูปธรรมใน pack ระดับ 1–2 (L1) จับกลุ่มด้วยคำแปลอังกฤษ/ไทย → `concept id` (เช่น `apple`) · คำนามธรรม/คำกริยาบางคำ/ไวยากรณ์ = ไม่ทำภาพ · ตารางคำ → concept อยู่ใน `lang-calc.js` หรือไฟล์ JSON แยก
2. prompt ฝั่งเซิร์ฟเวอร์: preset ใหม่ใน `functions/api/ai/image.js` (เช่น `vocab`: ภาพประกอบเรียบ พื้นหลังเรียบ วัตถุเดียวกลางภาพ **ไม่มีตัวอักษรในภาพ**) — ห้ามให้ client ส่ง prompt ยาวอิสระมาแทน preset
3. สร้างแบบทยอย ไม่แย่งโควตาของงานอื่น: หน้า "จัดการภาพคำศัพท์" (เฉพาะ `*.pages.dev`) กด "สร้างอีก N ภาพ" เอง (N ≤ 50/ครั้ง) โดยดู `/api/ai/usage` ก่อน และหยุดเมื่อเหลือโควตา < 3,000 (เผื่อแชท/ถอดเสียง) · **ไม่ใช้ scheduler สร้างอัตโนมัติ** เว้นแต่เจ้าของสั่ง
4. ตรวจก่อนใช้: ทุกภาพสถานะ `pending` จนเจ้าของกด ✓ / สร้างใหม่ / ไม่ใช้ภาพ (ภาพ AI อาจผิดความหมายหรือมีตัวหนังสือมั่ว) · ภาพที่ไม่ผ่านไม่แสดงในการ์ด
5. เก็บ: ไฟล์ R2 ns `images` เหมือน image-gen (มี `/api/files` อยู่แล้ว) + แผนที่ `tanot:lang:pics` (sync map `concept → {id, status}`) · ภาพที่ผ่านแล้วย่อเป็น WebP ≤ 256px (~10–20 KB) เพื่อการ์ด · **เจ้าของตัดสิน 2026-11-26: ภาพอยู่บน Cloudflare R2 อย่างเดียว ไม่ commit เข้า repo** — หน้าเว็บโหลดผ่าน `/api/files?id=…` (เฉพาะ `*.pages.dev`; ที่อื่น/ไม่มีภาพ = การ์ดแบบข้อความเหมือนเดิม) · แคชในเครื่องแบบเดียวกับภาพพื้นหลังที่ผู้ใช้ตั้งเอง: cache-first ใน cache แยกของ `sw.js` (เช่น `tanot-langpics-v1`, ลงแคชเฉพาะ ok + `image/*`, ไม่ถูกลบตอน bump `CACHE`) — ต้องแก้ `sw.js` ให้ยกเว้น `GET /api/files?id=…&lp=1` เหมือนข้อยกเว้น `&bg=1`
6. ใช้ในหน้า: การ์ดคำ (หน้าการ์ดแสดงภาพแทนคำแปลไทยเป็นตัวเลือก "ภาพ → คำ"), เกมจับคู่ภาพ-คำ (L2), ฉากสวมบทบาท 8 ฉาก (L5 — ภาพหัวฉาก 8 ภาพ), ข้อสอบแนว TOEIC Part 1 (ตอนนี้ใช้ภาพ unDraw)
7. เทสต์: `/api/ai/image` ปลอม + R2 ปลอม (แบบ `tests/image-gen.spec.js`) · preset ใหม่ known-answer · ภาพ pending ไม่แสดง · หยุดเมื่อโควตาต่ำ
8. ต้องทำ L1 ก่อน (ใช้ pack + `lang-practice:faces`)

### นอกขอบเขต / ไม่แนะนำ
- คัดลอกโค้ด freelingo (AGPL) · ใช้รายการคำ Oxford/Cambridge · ส่งเนื้อหาผู้ใช้ไป API ภายนอกนอกจาก Workers AI ของเราเอง · Forvo/YouGlish (ข้อกำหนดการใช้งาน, ต้องมีคีย์) · ส่งออก .apkg (sqlite ในเบราว์เซอร์ = dependency หนัก) — ถ้าเจ้าของอยากได้ ส่งออก TSV ที่ Anki นำเข้าได้แทน (งานเล็ก เพิ่มแถวใหม่)
- แยก `languages.jsx` เป็นหลายไฟล์ (ต้องเปิด `--bundle` ใน `build-react.sh` → output เปลี่ยนทั้งก้อน) — ถ้าจะทำ ทำเป็นงานแยก พร้อมเทสต์ทุกโหมดก่อน/หลัง

---

## 5. ลำดับและการพึ่งพา
```
L0 ─┬─> L1 ─┬─> L2
    │       ├─> L7
    │       └─> L3 ──> (การ์ด ::u:: + lang-practice:faces ใช้ร่วม L4/L5)
    └─(ไม่พึ่ง)  L4 ──> L8
                 L5   (ใช้หมวดวลีเดิม — เริ่มได้เลย แต่ปุ่ม "เพิ่มเป็นการ์ด" ต้องมี lang-practice:faces จาก L1/L3)
                 L6   (อิสระ)
```
งานที่เริ่มได้ทันทีโดยไม่ต้องรอข้อมูล: L0, L4, L5, L6 · ถ้าทำ L3/L4/L5 ก่อน L1 ให้งานแรกที่ทำเป็นคนสร้าง `lang-practice:faces` + แก้ `review.js` ตาม L1 ข้อ 4

---

## 7. อังกฤษสำหรับงาน (EW1–EW4 — เจ้าของเพิ่ม 2026-11-26, รับจาก `docs/learning-plan.md` ของ branch `claude/admiring-mayer-q36c31`)
**ผู้เรียน**: วิศวกรบำรุงรักษาที่ทำงานข้ามสาขา (วางแผน ประเมินราคา คุมงาน เอกสาร สัญญา) อาจต้องขาย/นำเสนอลูกค้า · อ่านเอกสารเทคนิคได้ · ปัญหา (ก) สะกดสระผิด (ea/ee, a/e, e ท้ายคำ, -tion/-sion) (ข) พูดแล้วนึกคำไม่ออก ยังไม่เคยคุยกับชาวต่างชาติ · เป้าหมาย = ใช้ทำงานได้จริง ไม่ใช่คะแนน · ฝึกสั้นวันละ 10–20 นาที
**กฎร่วม**: repo public → สถานการณ์สมมุติเท่านั้น ห้ามข้อมูลจริงของหน่วยงาน/เจ้าของ · ไม่คัดลอกข้อความ FIDIC (เขียนเอง) · AI = `/api/ai/chat` โมเดล `main` เท่านั้น · ประโยคเดิม/คีย์ SRS เดิมห้ามแก้หรือสลับ เพิ่มอย่างเดียว · session แผนวิศวกรรม (แถว 40–61) ไม่แตะ `languages.*`/`lang-calc.js` แต่ `react-pages.css` ใช้ร่วมกับ classroom-engineering (แถว 48) → merge ทีละงานแล้ว `./build-react.sh` บน main ล่าสุดก่อนงานถัดไป

### E1 — ประโยคสำเร็จรูปสำหรับงาน 10 หมวด (แถว 33)
- **ตัดสินแล้ว: ใส่ใน `lang-data` ของ `lang-en`** (ไม่ใช่ lang-packs) — เพราะโหมดที่มีอยู่ (ฟังแล้วเขียน `ShadowingPanel`/`ListeningPanel`, พูดตาม, คิว `wrong`/SRS) อ่าน `LANGS[id].phrases[หมวด]` อยู่แล้ว ใช้ได้ทันทีไม่ต้องเขียนโหมดใหม่ · ข้อความเขียนเอง ไม่ใช่ข้อมูลจากแหล่งภายนอก จึงไม่ต้องผ่านสคริปต์ L0 · ขนาด ~250 ประโยค ≈ 40 KB ใน HTML รับได้
- คีย์ SRS/wrong ของวลี = `${langId}::${หมวด}::${idx}` → หมวดใหม่ไม่ชนของเดิม · **ต่อท้าย object `phrases` เท่านั้น ห้ามแก้ 8 หมวดเดิม** · ชื่อหมวดใหม่ตั้งครั้งเดียวแล้วห้ามเปลี่ยน (เป็นส่วนหนึ่งของคีย์) · ในหมวดเพิ่มประโยคได้เฉพาะต่อท้าย
- 10 หมวด (ชื่อหมวดเป็นไทย ขึ้นต้น "งาน: " เพื่อจัดกลุ่มใน UI): ประชุมหน้างาน · แจ้งเหตุขัดข้อง/สถานะงานซ่อม · ผู้รับเหมา/ตรวจรับงาน · ความปลอดภัย (PTW, LOTO) · อีเมล/รายงาน · ประเมินราคา/ใบเสนอราคา · เงื่อนไขสัญญา (variation, EOT, liquidated damages, defects liability) · นำเสนอลูกค้า/ผู้บริหาร · ขาย/presales · สัมภาษณ์งานตำแหน่งวิศวกร (แนะนำตัว, STAR, คำถามเทคนิค)
- หมวดละ 20–30 ประโยค `{target, thai}` (+ `note` สั้นเฉพาะเมื่อจำเป็น เช่น ความหมายเชิงสัญญาของ LD) · ประโยคใช้ได้ทันที เป็นธรรมชาติ ระดับ B1–B2 · ตรวจด้วย `humanizer` · ศัพท์สัญญาอธิบายด้วยคำของเราเอง
- UI: ตัวเลือกหมวดของอังกฤษแสดงหมวดงานเป็นกลุ่ม "งาน" (ถ้าแตะ UI ใช้ `tanot-design`) · `./build-react.sh` (Tailwind อ่าน `.html` ด้วย)
- เทสต์: 8 หมวดเดิม + ลำดับประโยคเดิมไม่เปลี่ยน (เทียบกับ fixture ที่ดึงจาก main), หมวดใหม่ 10 หมวด × 20–30, ทุกประโยคมี thai, ไม่มีคำจาก stop-list (ชื่อหน่วยงานจริง/ชื่อคน), เข้าโหมดฟังแล้วเขียน/พูดตามได้

### E2 — สมุดคำที่สะกดผิด (แถว 34)
- ตรรกะใน `lang-calc.js` บล็อก "// ── E2 สะกดผิด" → `LangCalc.spell`: `diffKind(target, typed)` → `vowel-pair` (ea↔ee, ie↔ei, ou↔ow, ai↔ay…), `vowel-swap` (a↔e, i↔y, o↔u…), `silent-e` (ขาด/เกิน e ท้าย), `double` (ตัวซ้ำขาด/เกิน), `suffix` (-tion/-sion, -able/-ible, -ance/-ence, -ent/-ant), `other` (ผิดหลายจุด = รูปแบบหลักตามลำดับความสำคัญที่กำหนดในโค้ด) · `wordsOf(target, typed)` จับคู่คำในประโยคเพื่อหาคำที่ผิด · `record(map, word, kind, now)` · `groups(map)` · known-answer ≥ 40 กรณี
- คีย์ใหม่ `lang-practice:spell` = **sync map** 1 คำ = 1 doc `{word, kind, count, last, kinds:{kind:n}}` · กฎ `data-registry.js` เหนือ `{prefix:'lang-practice:'}` · **ห้ามแก้ `lang-practice:wrong`** (ยังเขียนตามเดิม) · เขียนด้วย `TanotData.update` · เพดาน 500 คำ (ตัดที่ `last` เก่าสุด) · `__proto__`/คีย์แปลกถูกปฏิเสธ
- บันทึกจากโหมดฟังแล้วเขียน + พิมพ์คำแปล + แต่งประโยค (อังกฤษก่อน ภาษาอื่นที่ใช้อักษรละตินได้ด้วยถ้าตรรกะไม่ผูกอังกฤษ)
- หน้า "คำที่สะกดผิด" จัดกลุ่มตามรูปแบบ (นับคำ/ครั้ง) + ปุ่ม "ฝึกกลุ่มนี้" → ฟังแล้วเขียนเฉพาะคำในกลุ่ม (ใช้ `SpellDiff` เดิม) · ลบรายคำได้
- เทสต์ `tests/languages-spell.spec.js` (known-answer + หน้า + ซิงก์ 2 context)

### E3 — ฉากงานในโหมดสวมบทบาท L5 + ประโยคฉบับแก้ (แถว 35)
- ต่อยอด L5 (`LangCalc` บล็อก L5 `SCENES`) — เพิ่มฉากงานตาม 10 หมวดของ E1 (L5 มีฉากสัมภาษณ์งานทั่วไปแล้ว → ฉากใหม่เป็นสัมภาษณ์ตำแหน่งวิศวกร) **ต่อท้าย id ใหม่ ไม่แก้ฉากเดิม** · บทบาท AI: ที่ปรึกษา, ผู้รับเหมาต่างชาติ, หัวหน้า, ลูกค้า, ผู้สัมภาษณ์
- ทุกคำตอบของผู้ใช้แสดง "ที่พูด/พิมพ์" คู่กับ "ฉบับแก้" (จาก `fix` ใน JSON ของ L5 — ถ้า L5 ทำไว้แล้วให้ตรวจว่าเห็นคู่กันชัด) + ปุ่ม "เก็บเป็นการ์ด" ต่อประโยคฉบับแก้ → การ์ด `lang-en::u::<hash>` + `lang-practice:faces` (หน้า = ฉบับแก้, หลัง = คำแปลไทย/ต้นฉบับ)
- พูดได้ (ถอดเสียงทางเดียวกับ L4/L5) · ไม่มีคลาวด์ + iOS = ซ่อนโหมด · บทสนทนาไม่เก็บ
- ต้องรอ L5 (แถว 26) ผ่านตรวจ + E1

### E4 — พูดสรุปงานวันนี้ (แถว 36)
- ปุ่มอัดเสียง ≤ 2 นาที (ตัดอัตโนมัติที่ 120 วิ + ตัวนับเวลา) → ถอดเสียง (`AiClient.asr` บน pages.dev; ไม่งั้น `asr-worker.js` ไม่ใช่ iOS) → AI (`main`) แก้ไวยากรณ์/เสนอคำที่เหมาะกว่า ตอบ JSON `[{orig, fixed, note}]` ต่อประโยค (`LangCalc` บล็อก E4: `reviewMessages`, `parseReview` ทนผลผิดรูป) → ตารางต้นฉบับคู่ฉบับแก้ → ติ๊กเลือกประโยค → เก็บเป็นการ์ด (แบบ E3)
- **ไม่เก็บเสียงและข้อความถอดเสียง** (หน่วยความจำเท่านั้น; ไม่ลง problem log) · `LangCalc.award('lang', 10)` ต่อครั้งที่ทำจบ (ผ่าน `LearnCore.award`)
- ต้องรอ E3 (ใช้ส่วนประกอบแสดงคู่/เก็บการ์ดร่วมกัน)

---

## 6. วิธีทำงาน: 1 งาน = 1 session ใหม่ + session ตรวจแยก (เจ้าของสั่ง 2026-11-26)

**ทำไม**: session ใหม่เริ่มจาก context ว่าง โหลดแค่ไฟล์นี้ + CLAUDE.md + skill ของแถวนั้น → ใช้ token น้อยกว่าทำต่อใน session ยาว และไม่สับสนกับงานก่อนหน้า · มีคนตรวจแยกจากคนทำ จับข้อผิดได้มากกว่าตรวจตัวเอง

### ตารางสรุป (ตรงกับแถว 21–29 ใน ROADMAP — ถ้าขัดกัน เชื่อ ROADMAP)
| งาน | แถว | โมเดล | effort | skill เพิ่ม (นอกจากชุดเสมอ `tanot-session`, `ponytail`, `verification-before-completion`, `tanot-pr-review`) | เริ่มได้เมื่อ |
|---|---|---|---|---|---|
| L0 ข้อมูล + license | 21 | Sonnet 5.5 | medium | `test-driven-development`, `security-and-hardening` | ทันที |
| L1 คำที่ใช้บ่อย + ประโยค 🔍 | 22 | Opus 5.5 | high | `tanot-design`, `vercel-react-best-practices`, `test-driven-development` | หลัง L0 merge |
| L2 เกม | 23 | Sonnet 5.5 | medium | `tanot-design`, `vercel-react-best-practices`, `test-driven-development`, `break-ui` | หลัง L1 |
| L3 อ่านจากข้อความ | 24 | Sonnet 5.5 | high | `tanot-design`, `vercel-react-best-practices`, `test-driven-development` | หลัง L1 |
| L4 ซับไตเติล + พูดตาม | 25 | Sonnet 5.5 | high | `tanot-design`, `vercel-react-best-practices`, `test-driven-development`, `transformers-js` | ทันที |
| L5 สวมบทบาท AI | 26 | Sonnet 5.5 | medium | `tanot-design`, `vercel-react-best-practices`, `test-driven-development` | ทันที |
| L6 เสียงอ่าน 🔍 | 27 | Opus 5.5 | high | `transformers-js`, `tanot-design`, `performance`, `systematic-debugging` | ทันที |
| L7 วัดระดับ + แผน | 28 | Sonnet 5.5 | medium | `tanot-design`, `vercel-react-best-practices`, `test-driven-development` | หลัง L1 |
| L9 ภาพประกอบคำศัพท์ (FLUX) | 31 | Sonnet 5.5 | high | `tanot-design`, `vercel-react-best-practices`, `test-driven-development`, `workers-best-practices` | หลัง L1 |
| L8 คะแนนออกเสียง | 29 | Opus 5.5 | high | `transformers-js`, `performance` | พักไว้ (หลัง L4 + ผลวัด) |
| E1 ประโยคงาน 10 หมวด | 33 | Opus 5.5 | medium | `humanizer`, `tanot-design` | ทันที (ไม่ชน L1/L4/L5 ถ้าแตะเฉพาะ `lang-data`) |
| E2 สมุดคำสะกดผิด | 34 | Sonnet 5.5 | high | `test-driven-development`, `tanot-design`, `vercel-react-best-practices` | หลังรวม L1/L4/L5 เข้า main |
| E3 ฉากงานสวมบทบาท | 35 | Sonnet 5.5 | high | `tanot-design`, `vercel-react-best-practices`, `test-driven-development`, `humanizer` | หลัง L5 + E1 merge |
| E4 พูดสรุปงานวันนี้ | 36 | Sonnet 5.5 | high | `tanot-design`, `vercel-react-best-practices`, `test-driven-development` | หลัง E3 |
| **ตรวจงานทุกแถว** | — | Opus 5.5 (🔍: Fable 5.2 ถ้ามี) | high | `ponytail-review`, `tanot-pr-review`, `receiving-code-review` | หลังคนทำ push |

### ขั้นตอนของ session ทำงาน (เปิดใหม่ทุกงาน)
1. เปิด session ใหม่บน repo นี้ เลือกโมเดล/effort ตามตาราง แล้วพิมพ์ประโยคเดียว เช่น:
   > ทำ ROADMAP แถว 22 (ภาษา L1) ตาม docs/languages-design.md — branch `claude/lang-l1-packs`
2. session เรียก `tanot-session` เอง → อ่านแถว + §1 §3 + หัวข้อ L ของงาน → โหลด skill ในตาราง → ทำ → รันเทสต์จริง (`node repo-guards.mjs`, spec ของงาน, `smoke.spec.js`, `theme-audit.spec.js` ถ้าแตะ UI) → แก้สถานะแถวใน ROADMAP → commit + push branch ของตัวเอง (ไม่ merge, ไม่เปิด PR เว้นแต่เจ้าของสั่ง)
3. ตอบเจ้าของ: ชื่อ branch · hash commit · คำสั่งตรวจที่รันแล้ว + ผล · สิ่งที่ยังไม่ได้ตรวจ
4. ห้ามทำหลายแถวใน session เดียว · เจองานนอกขอบเขต = เพิ่มแถวใหม่ ไม่ทำพ่วง

### ขั้นตอนของ session ตรวจ (session ประจำของเจ้าของ — คือ session ที่เขียนไฟล์นี้ `claude/eloquent-planck-lp6c9l`)
1. เจ้าของส่งข้อความให้ session ตรวจ: "ตรวจ branch `<ชื่อ>` commit `<hash>` แถว <n>"
2. `git fetch origin <branch>` → diff เทียบ `origin/main` ทั้งหมด + อ่านโค้ดที่เชื่อม (ไม่ดูแค่บรรทัดที่เปลี่ยน)
3. ตรวจตาม `ponytail-review` (ตรรกะ/ความปลอดภัย/เทสต์) + `tanot-pr-review` (กฎเว็บ: CACHE, registry, i18n, credits, token ธีม, no-explainer) + เทียบกับหัวข้อ L ของงานว่าครบและไม่เกินขอบเขต
4. **รันเทสต์ของส่วนที่แก้ซ้ำเอง** ไม่เชื่อผลที่ session ทำงานรายงาน
5. ตอบครั้งเดียว: ผ่าน / ไม่ผ่าน + รายการที่ต้องแก้ทั้งหมดเรียงตามความรุนแรง เขียนให้คัดลอกไปวางใน session ทำงานได้เลย · ตรวจรอบเดียวต่อ commit · ไม่แก้โค้ดเอง ไม่โพสต์คอมเมนต์ใน PR เว้นแต่เจ้าของขอ
6. ผ่านแล้วเจ้าของค่อยสั่งเปิด PR/merge · แถวที่มี 🔍 ห้าม merge ก่อนผ่านการตรวจ

### ถ้าติด limit กลางงาน
งานที่ยังไม่ push = หายเมื่อเครื่อง cloud ถูกลบ → session ทำงาน commit + push เป็นช่วงๆ (ข้อความ commit ขึ้นต้น `wip:` ได้) · บัญชีใหม่เปิด session บน branch เดิม แล้วพิมพ์ "ทำต่อแถว <n> จาก branch `<ชื่อ>` — ดู git log + docs/languages-design.md"
