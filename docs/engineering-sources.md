# แหล่งข้อมูลวิศวกรรม (ค้น 2026-11-26 — ยังไม่ได้นำมาใช้ในเว็บ)

รายการนี้จัดตามส่วนของเว็บที่เกี่ยวกับวิศวกรรม ได้แก่ `classroom-engineering.html` (13 สาขา + หมวดบำรุงรักษาระบบไฟฟ้า 12 หัวข้อ), `electrical.html`, `maintenance.html`, `cad.html`/`cad-pro.html` และ `run.html` (ประเมินราคา)

**ความน่าเชื่อถือของข้อมูลในตาราง**
- **GitHub**: ดาว, license และวันที่ push ล่าสุดดึงจาก `gh api search/repositories` เมื่อ 2026-11-26 ถือว่าตรวจแล้ว ถ้า license เป็น `NOASSERTION` แปลว่า GitHub อ่านไฟล์ license ไม่ออก ต้องเปิด repo ดูเอง
- **Hugging Face / Mendeley / IEEE DataPort / UCI**: ได้มาจากผลค้นเว็บ เพราะ sandbox เปิด huggingface.co ไม่ได้ จึงยังไม่ได้เปิดดู dataset card และ license เอง ต้องเปิดตรวจก่อนใช้
- ไม่มีรายการไหนเพิ่มเข้า `credits.html` เพราะยังไม่ได้ใช้ ถ้าจะใช้ตัวไหนต้องเพิ่มการ์ดตามกฎเดิม

## 1. ข้อสอบ/คำถามวิศวกรรม (ใช้ทำข้อสอบในห้องเรียนหรือวัดคุณภาพ AI)

| แหล่ง | มีอะไร | license | ใช้กับ |
|---|---|---|---|
| [mznaser/ERI-Benchmark](https://huggingface.co/datasets/mznaser/ERI-Benchmark) (HF) · [arXiv 2603.02239](https://arxiv.org/abs/2603.02239) | คำสั่ง/คำถามเชิงเหตุผล 9 สาขา (โยธา เครื่องกล ไฟฟ้า เคมี สิ่งแวดล้อม การบิน วัสดุ อัคคีภัย อุตสาหการ) 55 สาขาย่อย | ยังไม่ได้ตรวจ | ห้องเรียนวิศวกรรม: ใช้เป็นต้นแบบข้อสอบของ 13 สาขาเดิม (แปลและตรวจทานเอง) |
| [AGI4Engineering/EngDesign](https://github.com/AGI4Engineering/EngDesign) · HF `opt1zer/EngDesign` | งานออกแบบเชิงวิศวกรรม 101 งานหลายสาขา (NeurIPS 2025) ตรวจด้วยการจำลอง ไม่ใช่เทียบคำตอบ | MIT (GitHub) | วัดว่า AI ของเว็บตอบงานออกแบบได้แค่ไหน ไม่เหมาะทำข้อสอบ |
| [EEE-Bench (arXiv 2411.01492)](https://arxiv.org/abs/2411.01492) | ข้อสอบไฟฟ้า/อิเล็กทรอนิกส์แบบมีรูปวงจร | ยังไม่ได้ตรวจ | หมวดไฟฟ้า (ต้องมีรูป) |
| [EngiBench (arXiv 2509.17677)](https://arxiv.org/abs/2509.17677) | โจทย์วิศวกรรม 3 ระดับความยาก | ไม่พบลิงก์ dataset | อ้างอิงได้อย่างเดียว |
| [Noru1/EEReasonBench](https://huggingface.co/datasets/Noru1/EEReasonBench) (HF) | ถาม-ตอบไฟฟ้า ชุดเล็ก | ยังไม่ได้ตรวจ | หมวดไฟฟ้า |
| [scb10x/thai_exam](https://huggingface.co/datasets/scb10x/thai_exam) (HF) | ข้อสอบไทย A-Level/O-NET/TGAT/TPAT1/IC | ยังไม่ได้ตรวจ | ไม่มีหมวดวิศวกรรมโดยตรง ใช้ได้แค่คณิต/ฟิสิกส์พื้นฐาน |

**ไม่พบ** dataset ข้อสอบใบอนุญาตของสภาวิศวกร (กว.) ที่เปิดให้ใช้ ข้อสอบไทยของห้องเรียนต้องเขียนเองต่อไป ส่วนชุดภาษาอังกฤษข้างบนใช้เป็นแนวโจทย์ได้

## 2. ตำราเปิด (ใช้เป็นแหล่งอ้างอิงเนื้อหาบทเรียน)

| ตำรา | license | สาขา |
|---|---|---|
| [Engineering Statics: Open and Interactive](https://eng.libretexts.org/Bookshelves/Mechanical_Engineering/Engineering_Statics%3A_Open_and_Interactive_(Baker_and_Haynes)) (LibreTexts) | CC BY-NC-SA 4.0 | โยธา/เครื่องกล |
| Engineering Thermodynamics (Olivier Cleynen) · [รายการ Open Textbook Library](https://open.umn.edu/opentextbooks/subjects/engineering) | CC BY-SA | เครื่องกล/เคมี |
| OpenStax University Physics Vol. 2 | CC BY | ไฟฟ้าพื้นฐาน |
| DC Circuits (Univ. of Oklahoma) | CC BY-NC-SA | ไฟฟ้า |

เว็บนี้เป็นเครื่องมือส่วนตัว ไม่ได้ขาย ตำรา NC จึงใช้อ้างอิงได้ ถ้าคัดลอกข้อความมาเกินกว่าการสรุปด้วยคำของเราเอง ต้องใส่ที่มาและเผยแพร่ต่อด้วย license เดียวกัน (SA)

## 3. ไลบรารีคำนวณแยกตามสาขา (ใช้ตรวจสูตรใน `*-calc.js` หรือทำ known-answer test)

ไลบรารีส่วนใหญ่เป็น Python ใช้ในหน้าเว็บตรงๆ ไม่ได้ แต่ใช้สร้างค่าคำตอบอ้างอิงให้ `tests/` ได้ คอลัมน์ "ใช้ในเว็บได้" แปลว่ามีรุ่น JS หรือ wasm

| สาขา/หน้า | repo | ดาว | license | ใช้ในเว็บได้ | หมายเหตุ |
|---|---|---|---|---|---|
| ไฟฟ้ากำลัง (`electrical`) | [e2nIEE/pandapower](https://github.com/e2nIEE/pandapower) | 1,336 | BSD-3 (GitHub อ่านไม่ออก) | ไม่ | load flow, ลัดวงจร IEC 60909, เส้นโค้งรีเลย์ IEC 60255 ใช้ตรวจสูตรลัดวงจร/รีเลย์ได้ดี |
| รีเลย์/ประสานการป้องกัน | [sandialabs/Protection-settings-optimizer](https://github.com/sandialabs/Protection-settings-optimizer) | 7 | GPL-3.0 | ไม่ | หาค่าตั้งรีเลย์ ถ้าคัดลอกโค้ดต้องเปิดซอร์สตาม GPL ใช้แค่เป็นแนวคิด |
| หม้อแปลง DGA (บำรุงรักษา) | [nagusubra/duvals_triangle_plotter](https://github.com/nagusubra/duvals_triangle_plotter) | 5 | MIT | พอร์ตง่าย | สามเหลี่ยม Duval จากก๊าซในน้ำมันหม้อแปลง ถ้าจะเพิ่มต้องเขียนเป็น JS ล้วนใน calc |
| ขนาดสาย/แรงดันตก | [mfarrasml/cable-sizing](https://github.com/mfarrasml/cable-sizing) | 3 | MIT | ? | repo เล็ก ใช้เทียบผลได้ ห้ามใช้เป็นแหล่งของตาราง วสท. |
| โซลาร์ | [pvlib/pvlib-python](https://github.com/pvlib/pvlib-python) | 1,735 | BSD-3 | ไม่ | ถ้าวันหนึ่งเพิ่มเครื่องคำนวณ PV |
| เครื่องกล/ความร้อน | [CoolProp/CoolProp](https://github.com/CoolProp/CoolProp) | 1,130 | MIT | **มี (มีรุ่น JS/wasm อย่างเป็นทางการ)** | คุณสมบัติไอน้ำ/สารทำความเย็น ใช้ทำเครื่องคำนวณ HVAC หรือหม้อไอน้ำได้ |
| โยธา/โครงสร้าง | [JWock82/Pynite](https://github.com/JWock82/Pynite) | 798 | MIT | ไม่ | FEM 3 มิติ ใช้ทำค่าคำตอบโจทย์คาน/โครงข้อหมุน |
| โยธา/แผ่นดินไหว | [zhuminjie/OpenSeesPy](https://github.com/zhuminjie/OpenSeesPy) | 296 | ต้องตรวจ | ไม่ | ใช้สำหรับงานวิจัย ซึ่งเกินขอบเขตเว็บนี้ |
| สิ่งแวดล้อม/ประปา | [epanet-js/epanet-js-toolkit](https://github.com/epanet-js/epanet-js-toolkit) | 223 | MIT | **มี (wasm)** | จำลองโครงข่ายท่อน้ำในเบราว์เซอร์ |
| เคมี | [Cantera/cantera](https://github.com/Cantera/cantera) | 891 | BSD-3 (GitHub อ่านไม่ออก) | ไม่ | จลนศาสตร์ เทอร์โมไดนามิกส์ |
| อุตสาหการ | [google/or-tools](https://github.com/google/or-tools) · [IanManske/YALPS](https://github.com/IanManske/YALPS) | 14,461 · 106 | Apache-2.0 · MIT | YALPS **มี (JS ล้วน)** | ใช้ทำ linear programming เช่น จัดตารางงาน PM หรือจัดสรรทรัพยากร |
| โทรคมนาคม | [inigodelportillo/ITU-Rpy](https://github.com/inigodelportillo/ITU-Rpy) | 174 | MIT | ไม่ | การลดทอนสัญญาณตามมาตรฐาน ITU-R P.* ใช้ทำค่าคำตอบ link budget |
| การบิน | [airinnova/ambiance](https://github.com/airinnova/ambiance) · [RocketPy](https://github.com/RocketPy-Team/RocketPy) | 46 · 1,182 | Apache-2.0 · MIT | ambiance พอร์ตง่าย | บรรยากาศมาตรฐาน ICAO 1993 (สูตรสั้น เขียนเป็น JS ได้) |
| ยานยนต์ | [juanmanzanero/fastest-lap](https://github.com/juanmanzanero/fastest-lap) | 658 | MIT | ไม่ | พลศาสตร์ยานยนต์ (หยุดพัฒนาตั้งแต่ปี 2023) |
| ปิโตรเลียม | [mwburgoyne/pyResToolbox](https://github.com/mwburgoyne/pyResToolbox) | 101 | GPL-3.0 | ไม่ | งานวิศวกรรมแหล่งกักเก็บ ใช้ได้แค่เป็นแหล่งอ้างอิงสูตร |
| เหมืองแร่ | [miningpy/miningpy](https://github.com/miningpy/miningpy) | 26 | MIT | ไม่ | block model (repo เล็ก) |
| ชีวการแพทย์ | [neuropsychology/NeuroKit](https://github.com/neuropsychology/NeuroKit) | 2,438 | MIT | ไม่ | ประมวลผลสัญญาณ ECG/EEG |

## 4. ข้อมูลงานบำรุงรักษา/PdM (`maintenance`, หมวด `elec-maint`)

| แหล่ง | มีอะไร | license |
|---|---|---|
| [AI4I 2020 (UCI)](https://archive.ics.uci.edu/dataset/601/ai4i+2020+predictive+maintenance+dataset) | ข้อมูลเครื่องจักรสังเคราะห์ 10,000 แถว มีโหมดการเสีย 5 แบบ | CC BY 4.0 |
| [kokikwbt/predictive-maintenance](https://github.com/kokikwbt/predictive-maintenance) | รายชื่อ dataset PdM | MIT |
| [VictorBauler/awesome-bearing-dataset](https://github.com/VictorBauler/awesome-bearing-dataset) | รวม dataset ลูกปืน (รวม CWRU) | MIT |
| [Charlie5DH/PredictiveMaintenance-and-Vibration-Resources](https://github.com/Charlie5DH/PredictiveMaintenance-and-Vibration-Resources) | รวมบทความและ dataset การสั่นสะเทือน | ไม่ระบุ |
| [IEEE DataPort — DGA หม้อแปลง](https://ieee-dataport.org/documents/dissolved-gas-data-transformer-oil-fault-diagnosis-power-transformers-membership-degree) | ค่า H2/CH4/C2H6/C2H4/C2H2 พร้อมชนิดความเสียหาย | ไม่ระบุในผลค้น |
| [Mendeley — ภาพความร้อนมอเตอร์เหนี่ยวนำ](https://data.mendeley.com/datasets/m4sbt8hbvk) · [หม้อแปลงแห้ง 255 ภาพ](https://data.mendeley.com/datasets/8mg8mkc7k5/2) | ภาพเทอร์โมกราฟีในสภาพปกติและเสีย | ต้องตรวจ |
| [Ryanflash/herislab-ca-training-data](https://huggingface.co/datasets/Ryanflash/herislab-ca-training-data) (HF) | ภาพอินฟราเรดมอเตอร์ และการตรวจแผง PV | ต้องตรวจ |

ข้อมูลกลุ่มนี้เหมาะทำตัวอย่างประกอบบทเรียนเทอร์โมกราฟีและ PdM ถ้าจะทำโมเดลจำแนกภาพความร้อนในเว็บ ต้องเพิ่มแถวในแผนแยกต่างหาก

## 5. CAD / BIM (`cad`, `cad-pro`)

| repo | ดาว | license | หมายเหตุ |
|---|---|---|---|
| [mozman/ezdxf](https://github.com/mozman/ezdxf) | 1,548 | MIT | Python สร้างไฟล์ DXF ทดสอบได้ครบทุกชนิด ใช้เสริม `tests/cad-dxf.spec.js` |
| [gdsestimating/dxf-parser](https://github.com/gdsestimating/dxf-parser) | 563 | MIT | ตัวอ่าน DXF แบบ JS เว็บใช้ CADCraft wasm แทนแล้ว จึงไม่ต้องใช้ |
| [ThatOpen/engine_web-ifc](https://github.com/ThatOpen/engine_web-ifc) | 1,105 | MPL-2.0 | อ่าน/เขียน IFC (BIM) ในเบราว์เซอร์ด้วย wasm ถ้าวันหนึ่งต้องการเปิดไฟล์ BIM |
| [sgenoud/replicad](https://github.com/sgenoud/replicad) | 727 | MIT | สร้างโมเดล 3 มิติด้วยโค้ด (OCCT wasm) ใกล้กับแท็บ 3 มิติของ `cad.html` |
| [bernhard-42/three-cad-viewer](https://github.com/bernhard-42/three-cad-viewer) | 399 | MIT | ตัวแสดงชิ้นงาน CAD บน three.js |
| [SadilKhan/Text2CAD](https://huggingface.co/datasets/SadilKhan/Text2CAD) (HF, gated) | 500 | CC BY-NC-SA 4.0 | ข้อความ → ลำดับคำสั่ง CAD (ต่อยอดจาก DeepCAD ~150k แบบ) ไฟล์ใหญ่ เหมาะกับงานวิจัย ไม่ใช่เว็บนี้ |
| [FreeCAD](https://github.com/FreeCAD/FreeCAD) · [LibreCAD](https://github.com/LibreCAD/LibreCAD) | 35,806 · 6,645 | LGPL-2.1 · GPL | โปรแกรมเดสก์ท็อป ใช้เปิดไฟล์ที่เว็บส่งออกเพื่อตรวจว่าเปิดได้ถูก |

## 6. มาตรฐานไทย

ไม่พบไฟล์ **มาตรฐานการติดตั้งทางไฟฟ้าสำหรับประเทศไทย (วสท. 2564)** ที่ดาวน์โหลดได้ฟรีอย่างเป็นทางการ วสท. ขายเป็นเล่ม (eit.or.th) ส่วนตารางขนาดสาย/แรงดันตกของ กฟภ./กฟน. ต้องขอจากหน่วยงานโดยตรง ข้อมูลที่หาได้มีแค่ มอก. 11-2553 (สาย PVC) ที่ Schneider Electric อ้างถึง และรายงานสหกิจศึกษาของนักศึกษา ซึ่งไม่ใช่แหล่งทางการ ตัวเลขใน `electrical-calc.js` จึงยังต้องอ้างจากเล่มที่เจ้าของมี

## ข้อเสนอ ถ้าจะใช้ต่อ (ต้องเพิ่มแถวในแผนก่อน)

1. **ทำค่าคำตอบอ้างอิงจาก pandapower** แล้วเทียบกับสูตรลัดวงจรและรีเลย์ใน `electrical-calc.js` เพิ่มเป็น known-answer test (ใช้ Colab ได้ ไม่ต้องเพิ่ม dependency ใน repo)
2. **เพิ่มสามเหลี่ยม Duval (DGA)** เข้าหน้า `maintenance` หรือบทเรียนหม้อแปลง เป็นสูตร JS ล้วนใน calc (MIT ของ repo ต้นแบบใช้เป็นแหล่งอ้างอิงได้)
3. **ใช้ ERI-Benchmark เป็นแนวข้อสอบ** ของ 13 สาขาเดิม เพิ่มข้อสอบต่อท้ายตามกฎเดิม (เจ้าของต้องตรวจทาน และต้องตรวจ license ของ dataset ก่อน)
4. **ใช้ ezdxf สร้างไฟล์ DXF ทดสอบ** ชนิดที่ยังไม่มีในเทสต์
