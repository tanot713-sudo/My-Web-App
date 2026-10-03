# ยุบรวมหน้าลงทุน: เอกสารออกแบบ (ROADMAP Phase 6 · การใช้ชีวิต · P2 · M)

เอกสารนี้เป็นแบบให้ session ถัดไปลงมือทำตามได้ทันที ยังไม่มีการแก้โค้ดหน้าเว็บในรอบออกแบบ
ทุกอย่างอ้างอิงโค้ด ณ commit `b8b60e4` (main, 2026-10-03)

ผลลัพธ์ที่ต้องการ:
- 17 หน้า (`invest.html` + `invest-*.html` 16 หน้า) เหลือ **10 หน้า** + **หน้า redirect 9 หน้า**
- `invest-calc.js` (ตรรกะล้วน) + `invest-core.js` (ดึงข้อมูล/แคช/UI กลาง) ใช้ร่วมกันทุกหน้า
- การ์ด "สินทรัพย์ลงทุน" บนหน้าวันนี้ พร้อมกราฟย้อนหลังจาก snapshot วันละครั้ง
- **ไม่มีคีย์ข้อมูลผู้ใช้เดิมคีย์ไหนเปลี่ยนชื่อหรือเปลี่ยนรูปแบบ**

---

## 0. สิ่งที่เจ้าของตัดสินใจแล้ว (2026-10-03)

| เรื่อง | ตัดสินใจ |
|---|---|
| พอร์ตจำลอง (`invest-portfolio`) | ย้ายเป็นแท็บ `#paper` ในหน้าหุ้น ใช้คีย์เดิม `tanot:invest:portfolio` · **ไม่นับรวม**ในมูลค่าสินทรัพย์ |
| ปุ่มสำรอง Google Drive รายหน้า (5 ไฟล์) | **เลิกใช้**ในหน้าใหม่ · ไฟล์เดิมใน Drive ไม่แตะ · การสำรองข้อมูลใช้ `drive-backup.js` ร่วมกับการซิงก์ D1 |
| ขอบเขตมูลค่าสินทรัพย์ | **เฉพาะสินทรัพย์ลงทุน** (หุ้นไทย/นอก, Bitcoin, ทอง, กองทุน, พันธบัตร, สลากออมสิน/ธ.ก.ส.) ไม่มีเงินฝาก/หนี้ |
| public CORS proxy สำรอง + rss2json | **ตัด** ใช้ `/api/proxy` อย่างเดียว (+ fetch ตรงเฉพาะ API ที่เปิด CORS เอง) |
| AI ในเบราว์เซอร์ (สำรองของสรุป AI) | **ตัด** หน้าลงทุนใช้ AI บนคลาวด์อย่างเดียว |
| ตั้งค่า Live Gateway / Twelve Data | **เก็บไว้** (ไม่มีของแทนที่ดีกว่า) ย้ายเป็นกล่องตั้งค่าเดียวใน `invest-core.js` |
| หน้ารวม: ปุ่ม AI ผู้ช่วยลอย, ป๊อปอัพเปิดเครื่องมือ (`?embed=1`), ช่องค้นหา, Portfolio Health + รายการที่ต้องทำ | **ตัดทั้ง 4** (KPI/วิดเจ็ตแชทกลาง/ลิงก์ตรง/ค้นหาด่วน Ctrl+K/กราฟสัดส่วนตามประเภททำหน้าที่แทน) |
| Expectancy ในหน้าหุ้น | **ตัด** ใช้ expectancy จากสมุดเทรดจริงแทน |
| คำนวณภาษีในหน้ากองทุนไทย | **ทั้งสองอย่าง**: การ์ดในแท็บกองทุนไทยคำนวณด้วย `TaxCalc` + `tax-rules/*.json` (เลิกใช้สูตร/เพดานที่ฝังใน JS) **และ**มีปุ่มไป `tax.html#sim` (แท็บ "ถ้าซื้อเพิ่ม") |
| สัดส่วนทองในพอร์ต (หน้าทอง) | **ตัด** ใช้ % ทองจริงจากมูลค่าสินทรัพย์ในหน้ารวมแทน |

ที่ "รวม" ไม่ใช่ "ตัด" (ไม่ต้องถามอีก): สมุดเทรดของหุ้นนอก/Bitcoin ย้ายไปหน้าสมุดเทรดรวม · ดัชนีกลัว-โลภ/อัตราแลกเปลี่ยน/สูตรอินดิเคเตอร์ที่ซ้ำกันหลายชุดเหลือชุดเดียว

---

## 1. สำรวจ

### 1.1 หน้าเดิม 17 หน้า

| หน้า | JS | บรรทัด (html+js) | การ์ด/ฟีเจอร์ | คีย์ข้อมูลผู้ใช้ที่เขียน |
|---|---|---|---|---|
| `invest.html` (หน้ารวม) | inline ในหน้า | 1043 | KPI มูลค่า/กำไร/Health/เงินสด, กราฟมูลค่า 30 วัน, ตลาด 3 กลุ่ม (เลือกสัญลักษณ์ได้), สินทรัพย์ในพอร์ต, เครื่องมือด่วน, Health, สัดส่วน, รายการที่ต้องทำ, ข่าว 3 ข่าว, กลัว-โลภ, ป๊อปอัพ iframe, AI ลอย, ช่องค้นหา | `hub:watch:<g>`, `hub:history` |
| `invest-thai-stock` | `invest-thai-stock.js` + `invest-drivesync.js` | 343+1679+215 | ดึงราคา .BK, กราฟ LWC + MA/RSI/Volume, ไฟจราจร + เหตุผล, สรุป AI, คุมเงิน (ล็อต 100, ค่าคอมขั้นต่ำ/วัน), เช็กลิสต์, พอร์ต + "ควรขาย?", Expectancy, ข่าวหุ้น/Opp Day, Live Gateway, `?sym=`, โหมด embed | `thstock` |
| `invest-trade-journal` | `invest-trade-journal.js` + drivesync | 73+102 | สมุดเทรดหุ้นไทย + สถิติ + Drive | `thjournal` |
| `invest-set50-scanner` | `invest-set50-scanner.js` | 75+264 | สแกน SET50 50 ตัว → ไฟจราจร, คลิก → หน้าหุ้นไทย | — |
| `invest-global-stock` | `invest-global-stock.js` | 329+1993 | เหมือนหุ้นไทย (โคลน) แต่ USD/หุ้นเดี่ยว, แปลงบาท, ตาราง "หุ้นดัง (US)" + สแกน, สมุดเทรด, Drive | `globalstock`, `globaljournal` |
| `invest-bitcoin` | `invest-bitcoin.js` | 329+1855 | ราคา BTC-USD, ไฟจราจร, กลัว-โลภ, กราฟ, AI, คุมเงิน (เศษส่วน), เช็กลิสต์, พอร์ต, สมุดเทรด, DCA, แปลงบาท, Live Gateway, Drive | `btc`, `btcjournal` |
| `invest-gold` | `invest-gold.js` | 235+1461 | ราคาทองไทย (thai-gold-api) + กรอกเอง, ถูก/แพง (GC=F), AI, คุมเงิน, เช็กลิสต์, DCA, ตลาดย่อ, สัดส่วนทอง, สมุดทอง, ปัจจัย DXY/TNX, Drive | `gold` |
| `invest-commodities` | `invest-commodities.js` | 184+1193 | การ์ดค่าเงิน/โลหะ/พลังงาน/เกษตร 16 ตัว + sparkline, กราฟแท่งเทียน, ถูก/แพง, AI, คุมเงิน, เช็กลิสต์, โหมด embed | — |
| `invest-thai-fund` | `invest-thai-fund.js` | 186+614 | DCA, ภาษี RMF/SSF/ESG (สูตรฝังใน JS), แผนภาษีหลายปี, ระดับความเสี่ยง 1–8, ตลาดย่อ, สมุดซื้อ, วันพร้อมขาย | `thaifund`, `thaifund:birthyear` |
| `invest-global-fund` | `invest-global-fund.js` | 119+278 | DCA S&P500, ตลาดย่อ, สมุดซื้อ (แยกชนิดสะสม/ปันผล) | `spfund` |
| `invest-gov-bond` | `invest-gov-bond.js` | 114+313 | YTM, เทียบเงินฝาก, สมุดพันธบัตร + ตารางดอกเบี้ย | `govbond` |
| `invest-gsb-lottery` | `invest-gsb-lottery.js` | 131+456 | ตารางรางวัล → EV, เทียบเงินฝาก, สมุดสลาก + บันทึกผลรายงวด | `gsblottery`, `gsblottery:tiers` |
| `invest-baac-lottery` | `invest-baac-lottery.js` | 131+460 | โคลนของออมสินแทบทั้งไฟล์ (ต่างกันแค่ข้อความ/ชื่อคีย์) | `baaclottery`, `baaclottery:tiers` |
| `invest-lottery` (สลากกินแบ่ง) | `invest-lottery.js` | 132+531 | ดึงผลย้อนหลังจาก thai-lotto-archive, สถิติความถี่, ตรวจหวย, สุ่มเลข | `lottery:spins`, `lottery:budget` |
| `invest-news` | `invest-news.js` | 70+263 | ชิปคำค้น 6 อัน + ค้นเอง, Google News RSS | — |
| `invest-portfolio` (พอร์ตจำลอง) | `invest-portfolio.js` | 120+558 | ซื้อ/ขายด้วยเงินสมมติ 1 ล้าน (ซื้อย้อนหลังได้), ประวัติ, Drive, โหมด embed | `portfolio` |
| `invest-business` | `invest-business.js` | 116+520 | ไอเดียอ้างอิง, จุดคุ้มทุน, เช็กลิสต์ความพร้อม, บันทึกไอเดีย | `bizplan` |

(ชื่อคีย์ในคอลัมน์สุดท้ายตัด `tanot:invest:` ข้างหน้าออก)

### 1.2 คีย์ข้อมูลผู้ใช้ (ห้ามเปลี่ยนชื่อ/รูปแบบ)

กฎใน `data-registry.js`: คีย์ที่ไม่มีกฎของตัวเองตกไปที่ `{ prefix: 'tanot:' }` = sync แบบ blob

| คีย์ | registry | รูปแบบ (ฟิลด์ที่มีจริงในโค้ด) | เขียนโดย | อ่านโดย |
|---|---|---|---|---|
| `tanot:invest:thstock` | sync list `ts` | `[{sym, shares, cost (฿/หุ้น), ts, cur?}]` · `cur` = ราคาที่ผู้ใช้พิมพ์หรือกด "ควรขาย?" ไม่มีเวลากำกับ | thai-stock (ผ่าน `InvestDrive`) | `invest.html`, `index.js` |
| `tanot:invest:thjournal` | sync list `ts` | `[{sym, en, ex, sh, pl (฿), ts}]` | trade-journal | — |
| `tanot:invest:globalstock` | sync list `ts` | `[{sym, shares, cost ($/หุ้น), ts, cur?}]` | global-stock | `invest.html`, `index.js` |
| `tanot:invest:globaljournal` | sync list `ts` | `[{sym, en, ex, sh, pl ($), ts}]` | global-stock | — |
| `tanot:invest:btc` | sync list `ts` | `[{qty, cost ($/BTC), ts, cur?}]` (ไม่มี `sym`) | bitcoin | `invest.html` |
| `tanot:invest:btcjournal` | sync list `ts` | `[{en, ex, qty, pl ($), ts}]` (ไม่มี `sym`) | bitcoin | — |
| `tanot:invest:gold` | sync list `ts` | `[{type: 'bar'\|'jewelry', unit: 'baht'\|'gram', amt (฿ ที่จ่าย), price (฿ ต่อหน่วย), weight (= amt/price ในหน่วย unit), ts}]` | gold | — |
| `tanot:invest:thaifund` | sync list `ts` | `[{fund, cat: 'rmf'\|'ssf'\|'esg'\|'general', amt (฿), nav, units, ts}]` | thai-fund | **`tax.js` `fundSums()`** (cat/amt/ts ปีปัจจุบันเวลาเครื่อง) |
| `tanot:invest:thaifund:birthyear` | sync blob | string ปี ค.ศ. เช่น `"1990"` | thai-fund | — |
| `tanot:invest:spfund` | sync list `ts` | `[{cls: 'สะสมมูลค่า'\|'ปันผล' (ค่าไทยตายตัว), amt (฿), nav, units, ts}]` | global-fund | — |
| `tanot:invest:govbond` | sync list `ts` | `[{name, purchDate 'YYYY-MM-DD', maturity 'YYYY-MM-DD', face (฿), coupon (%), freq 1\|2\|4, ts}]` | gov-bond | — |
| `tanot:invest:gsblottery` | sync list `ts` | `[{name, purchDate, maturity, unitPrice, units, drawFreq '16'\|'1,16', evPerDraw, results: {'YYYY-MM-DD': ฿}, ts}]` | gsb-lottery | — |
| `tanot:invest:gsblottery:tiers` | sync blob | ค่าฟอร์มคำนวณ `{unitPrice, units, purchDate, maturity, drawFreq, guarRate, taxExempt, tiers: [{label, amount, winners, totalUnits}]}` (ส่วนใหญ่เป็น string จาก input) | gsb-lottery | — |
| `tanot:invest:baaclottery` / `:tiers` | เหมือนออมสิน | รูปแบบเดียวกับออมสินทุกฟิลด์ | baac-lottery | — |
| `tanot:invest:bizplan` | sync list `ts` | `[{name, startup, fixed, price, varCost, vol, profitPerUnit, breakevenUnits, paybackMonths, monthlyProfitAtVol, ts}]` | business | — |
| `tanot:invest:portfolio` | sync blob | `{cash, startCash, holdings: [{sym, shares, avgCost}], tx: [{ts, type: 'buy'\|'sell', sym, shares, price, amount, realizedPl?}]}` (เงินสมมติ) | portfolio | `invest.html` (เอาไปรวมมูลค่า — จะเลิก) |
| `tanot:invest:lottery:spins` | sync blob | `[{n: '123456', ts}]` ≤ 20 | lottery | — |
| `tanot:invest:lottery:budget` | sync blob | string | lottery | — |
| `tanot:invest:hub:watch:thai\|global\|commod` | sync blob | `['PTT', …]` | `invest.html` | `invest.html` |
| `tanot:invest:hub:history` | sync blob | `[{d: 'YYYY-MM-DD' (UTC), v}]` ≤ 30 · **v รวมเงินสมมติของพอร์ตจำลอง** | `invest.html` | `invest.html` |

ไม่มี IndexedDB ในโซนลงทุน

### 1.3 คีย์เฉพาะเครื่องและคีย์แคช

| คีย์ | registry | หมายเหตุ |
|---|---|---|
| `tanot:market:live-config:v1` | local | `{provider: 'gateway'\|'twelvedata'\|'yahoo', gateway, apiKey, interval}` · มี API key ที่ UI บอกว่าเก็บในเครื่องเท่านั้น (ใช้ร่วมหุ้นไทย/นอก/BTC/หน้ารวม) |
| `tanot:aiChat:noBigModel` | local | ใช้ร่วมกับ `ai-chat-widget.js` — หน้าลงทุนจะเลิกอ่าน/เขียน แต่ห้ามลบ |
| `tanot:invest:driveConnected`, `tanot:invest:{globalstock,bitcoin,gold,portfolio}:driveConnected` | local (suffix) | หน้าใหม่ไม่ใช้แล้ว · ไม่ลบ |
| `ome:lang` | local | ภาษา UI กลาง |
| `tanot:invest:cache:<SYM>` | cache | series หุ้นไทย `{ts, t, o, h, l, c, v}` · **สแกนเนอร์เขียนแค่ `{ts, t, h, l, c}` ทับคีย์เดียวกัน** · `index.js` อ่าน `.c` |
| `tanot:invest:cache:us:<SYM>` | cache | series หุ้นนอก · `index.js` อ่าน `.c` |
| `tanot:invest:cache:btc:BTC-USD`, `…:btc:fng` | cache | series BTC, กลัว-โลภ |
| `tanot:invest:cache:gold:GC=F`, `…:gold:th`, `…:gold:dxy`, `…:gold:tnx` | cache | series ทองโลก, ราคาทองไทย `{barBuyPrice, barSellPrice, jewelryBuyPrice, jewelrySellPrice, updateDate, updateTime, ts}`, quote ปัจจัย · `tests/ai.spec.js` seed `gold:GC=F` |
| `tanot:invest:cache:comm:q:<sym>`, `…:comm:s:<sym>`, `…:comm:thaigold` | cache | quote / series / ทองไทย (คนละรูปแบบกับ `gold:th`) ของหน้าค่าเงิน |
| `tanot:invest:cache:hub:q:bk:<SYM>`, `…:hub:q:px:<sym>`, `…:hub:fng` | cache | quote ของหน้ารวม |
| `tanot:invest:newscache:<SYM>`, `…:us:<SYM>`, `…:hub:<query>` | cache | ข่าว |
| `tanot:invest:fxcache` | cache | `{ts, rate}` USD→THB |
| `tanot:invest:lottery:cache`, `…:lottery:latest` | cache | ผลสลากย้อนหลัง ~150–180 KB, งวดล่าสุด |
| `tanot:invest:comm:lastKey`, `tanot:invest:news:lastChip` | cache | สินทรัพย์/ชิปที่เลือกล่าสุด |

### 1.4 โค้ดที่ซ้ำกัน

| ส่วน | จำนวนชุด | สถานะ |
|---|---|---|
| `OWN_PROXY` (ยังมี fallback ไป Worker `tanot-cors-proxy` ที่ถูกลบแล้ว) | 9 ไฟล์ | ลบ fallback ทั้งหมด |
| proxy chain สาธารณะ (allorigins, codetabs, cors.eu.org, test.cors.workers.dev, cors.lol, ตรง) | 9 ไฟล์ | ตัด |
| `fetchOne` / `parseYahoo` / `parseQuoteLite` / `fetchPrice` | ทุกหน้าที่มีราคา | `parseYahoo` เหมือนกันทุกบรรทัดใน 4 หน้า |
| แคช series/quote (`saveCache/loadCache/getSeries`) | 7 ชุด, 5 รูปแบบคีย์ | ดู 3.5 |
| อัตราแลกเปลี่ยน (`fetchFxRate` + `tanot:invest:fxcache`) | หุ้นนอก, BTC, หน้ารวม (ดึงเองอีกแบบ, ค่าเริ่ม 36 ฝังไว้) | `InvestCore.fx()` |
| กลัว-โลภ | BTC, หน้ารวม | `InvestCore.fng()` |
| อินดิเคเตอร์ `sma/ema/rsi/macd/bollinger/atr/supRes/adx/psar` | หุ้นไทย/นอก/BTC/ทอง/สแกนเนอร์ | สูตร**เหมือนกันทุกบรรทัด** ในหุ้นไทย/นอก/BTC (ทองไม่มี psar, สแกนเนอร์ย่อ) |
| `analyzeSeries` (ไฟจราจร) | 5 ชุด | **ตรรกะ/คะแนนเหมือนกัน ต่างกันแค่ชื่อคีย์ข้อความเหตุผล** (เช่น `whyCheap` vs `whyCheapRange` vs `proCheapRange`) ทองไม่มี psar |
| `riskCalc` | 4 ชุด | ต่างกันจริง: ไทยปัดล็อต 100 + ค่าคอมขั้นต่ำ, นอกหุ้นเดี่ยว USD, BTC เศษส่วน, ทองเป็นบาท |
| `checklistChecks` (Pre-Trade) | 4 ชุด + business | เกณฑ์ต่างกันเล็กน้อย (BTC ห้ามเลเวอเรจ, ทอง/ค่าเงินถามเลเวอเรจ) |
| `sellVerdict` | 3 ชุด | ตรรกะเดียวกัน ข้อความต่าง |
| สรุป AI (`spawnProbedWorker`, `getAiSumWorkerAsync`, prompt, `stripLeakedInstructions`, `friendlyChatError`) | 5 ชุด | task: `stock:thaistock`, `stock:globalstock`, `stock:bitcoin`, `stock:gold`, `stock:commodities` · ในทอง/BTC/นอก/ค่าเงินยังมีโค้ดตาย `var cache = null; (cache ? cache.read(...) : …)` ของแคช Firebase เดิม |
| Drive sync (`DriveSync` + `mergeByTs`) | 5 ชุด (`invest-drivesync.js`, global-stock, bitcoin, gold, portfolio) | เลิกใช้ |
| Live Gateway (`liveCfg/fetchGatewayQuote/fetchTwelveQuote/setLiveUI/startLive`) | หุ้นไทย/นอก/BTC + ย่อในหน้ารวม | เก็บไว้ รวมเป็นชุดเดียว |
| i18n (`UI_LANG_KEY`, `getUILang`, `t`, `applyStaticI18n`) | 18 ชุด | ตัวช่วยเดียว ส่วนพจนานุกรมยังอยู่ในแต่ละหน้า |
| `addMonths/parseYMD/ymd/thaiDate` | bond, gsb, baac, lottery | `InvestCalc` |
| สลากออมสิน vs ธ.ก.ส. | ทั้งไฟล์ | ไฟล์เดียว parameter ตามชนิด |
| ข่าว RSS (`parseNewsRss`, rss2json) | หุ้นไทย/นอก/ข่าว/หน้ารวม | `InvestCore.news()` |

### 1.5 หน้าอื่นและเทสต์ที่อ้างถึงหน้าลงทุน

- `tax.js` อ่าน `tanot:invest:thaifund` (`fundSums()` บรรทัด ~219: `cat`, `amt`, `ts` ของปีปัจจุบัน) และฟัง `onChange` ด้วย regex `tanot:invest:thaifund$` (บรรทัด ~525)
- `index.js` การ์ด "หุ้นที่ติดตาม" (`renderStocks`, บรรทัด ~150–195): อ่าน `thstock`/`globalstock` + series cache `.c` ลิงก์ไป `invest-thai-stock.html`
- `shell.js` `MENU` (invest 14 รายการ) + `window.INVEST_CATS` (หน้าลงทุนใช้สร้างแถบหมวดย่อย) · `palette.js` ค้นจาก `OME_MENU`
- `sw.js` PRECACHE 34 ไฟล์ลงทุน (`CACHE = 'ome-v604'`)
- เทสต์: `today.spec.js` (seed `thstock`, `globalstock`, `cache:PTT`, `cache:us:AAPL`), `tax.spec.js` (seed `thaifund`), `ai.spec.js` (หน้า `invest-gold.html`, seed `cache:gold:GC=F`, เทสต์ถอยไปโมเดลในเบราว์เซอร์), `sync.spec.js`/`migrate.spec.js` (ใช้ `cache:us:AAPL` เป็นตัวอย่างแคช), `visual.spec.js` (17 หน้า, baseline 68 ภาพ), `smoke.spec.js` (ทุกหน้าในเมนู — สแกนเนอร์/สมุดเทรดไม่อยู่ในเมนูจึงไม่ถูกทดสอบ)
- `credits.html`: thai-gold-api, Alternative.me, thai-lotto-archive, Twelve Data, Lightweight Charts (ไม่มีรายการ public proxy/rss2json อยู่แล้ว)
- `functions/api/proxy.js` `ALLOWED_HOSTS`: `query1/query2.finance.yahoo.com`, `news.google.com`, `api.alternative.me` — **ไม่มี `api.chnwt.dev`** (ทองไทยผ่าน proxy ตัวเองได้ 403 แล้วไปพึ่ง public proxy)
- `docs/cors-proxy-worker-original.js` = เอกสารอ้างอิง ไม่แตะ

### 1.6 ปัญหาที่พบระหว่างสำรวจ (แก้ไปพร้อมการยุบ)

1. หน้ารวมเอา **เงินสมมติ 1,000,000 + หุ้นจำลอง** ไปรวมใน "มูลค่าพอร์ตรวม" และ `hub:history`
2. Drive sync ตอนเชื่อมต่อ (`firstSync`) รวมรายการจาก Drive เข้ากับในเครื่องด้วย `ts` แล้ว `setItem` ตรง → รายการที่ลบจากอีกเครื่องกลับมาได้
3. ลบรายการในสมุด/พอร์ตด้วย **ดัชนีแถว** (`splice(data-i)`) — ถ้าข้อมูลจากอีกเครื่องเข้ามาระหว่างนั้นจะลบผิดแถว → หน้าใหม่ลบด้วย `ts`
4. `hub:history` ใช้วันที่ UTC (`toISOString`) — 00:00–06:59 เวลาไทยนับเป็นวันก่อน
5. หน้ารวมใช้อัตรา USD/THB ค่าเริ่ม 36 ที่ฝังไว้เมื่อดึงไม่ได้ (ตัวเลขแต่งขึ้น)
6. สแกนเนอร์เขียน series แบบไม่มี `o/v` ทับแคชของหน้าหุ้นไทย
7. ภาษีในหน้ากองทุนไทยใช้ขั้นบันได/เพดาน/กฎ ESG ที่ฝังใน JS (ขัด CLAUDE.md ที่ให้ตัวเลขภาษีอยู่ใน `tax-rules/*.json`)
8. โค้ดตายของแคชสรุป AI จากยุค Firebase (`var cache = null`) ใน 4 ไฟล์
9. หน้าทองให้มูลค่าทองรูปพรรณด้วยราคารับซื้อทองแท่ง (ควรใช้ราคารับซื้อทองรูปพรรณ)

---

## 2. โครงหน้าใหม่ (10 หน้า)

| # | หน้า (URL) | แท็บ (hash) | มาจาก | JS |
|---|---|---|---|---|
| 1 | `invest.html` ภาพรวม | — | หน้ารวมเดิม (ตัด 4 ฟีเจอร์ + เลิกนับพอร์ตจำลอง) | `invest-hub.js` (ย้ายจาก inline) |
| 2 | `invest-stock.html` **ใหม่** หุ้น | `#th` หุ้นไทย · `#us` หุ้นต่างประเทศ · `#scan` สแกนเนอร์ · `#paper` พอร์ตจำลอง | thai-stock, global-stock, set50-scanner + ตาราง "หุ้นดัง (US)", portfolio | `invest-stock.js` (th/us ใช้โค้ดเดียว parameter ตามตลาด), `invest-scan.js`, `invest-paper.js` |
| 3 | `invest-fund.html` **ใหม่** กองทุน | `#th` กองทุนไทย · `#global` กองทุนต่างประเทศ | thai-fund, global-fund | `invest-fund.js` |
| 4 | `invest-gold.html` ทอง & สินค้าโภคภัณฑ์ | `#gold` ทองคำ · `#markets` ค่าเงิน & วัตถุดิบ | gold, commodities | `invest-gold.js`, `invest-markets.js` |
| 5 | `invest-bitcoin.html` คริปโต | — | bitcoin (ตัดสมุดเทรด/Drive ออก) | `invest-bitcoin.js` |
| 6 | `invest-gov-bond.html` พันธบัตร | — | gov-bond | `invest-gov-bond.js` |
| 7 | `invest-lottery.html` สลาก | `#gsb` ออมสิน · `#baac` ธ.ก.ส. · `#govt` สลากกินแบ่ง | gsb-lottery, baac-lottery, lottery | `invest-savings-lottery.js` (gsb/baac), `invest-lottery.js` (govt) |
| 8 | `invest-trade-journal.html` สมุดเทรด | `#all` · `#th` · `#us` · `#btc` | trade-journal + สมุดในหุ้นนอก/BTC | `invest-trade-journal.js` |
| 9 | `invest-news.html` ข่าว | — | news | `invest-news.js` |
| 10 | `invest-business.html` แผนธุรกิจ | — | business | `invest-business.js` |

ไฟล์ร่วม: `invest-calc.js`, `invest-core.js` (โหลดก่อน JS ของหน้า)

**หน้าเดิม → ที่อยู่ใหม่**

| URL เดิม | ไปที่ |
|---|---|
| `invest-thai-stock.html[?sym=X]` | `invest-stock.html[?sym=X]#th` |
| `invest-global-stock.html[?sym=X]` | `invest-stock.html[?sym=X]#us` |
| `invest-set50-scanner.html` | `invest-stock.html#scan` |
| `invest-portfolio.html` | `invest-stock.html#paper` |
| `invest-thai-fund.html` | `invest-fund.html#th` |
| `invest-global-fund.html` | `invest-fund.html#global` |
| `invest-commodities.html` | `invest-gold.html#markets` |
| `invest-gsb-lottery.html` | `invest-lottery.html#gsb` |
| `invest-baac-lottery.html` | `invest-lottery.html#baac` |
| `invest.html`, `invest-gold.html`, `invest-bitcoin.html`, `invest-gov-bond.html`, `invest-lottery.html`, `invest-trade-journal.html`, `invest-news.html`, `invest-business.html` | URL เดิม (เนื้อหาเปลี่ยนตามตารางบน) |

**กติกาแท็บ (ทุกหน้าที่มีแท็บ)** ผ่าน `InvestCore.tabs()`:
- เลือกแท็บจาก `location.hash` ก่อน → ไม่มี hash ใช้แท็บล่าสุดที่จำไว้ใน `tanot:invest:ui` (local) → ไม่เคยเปิด ใช้ค่าเริ่ม
- ค่าเริ่ม: หุ้น `th` · กองทุน `th` · ทอง `gold` · สมุดเทรด `all` · สลาก **`govt`** (เพราะ `invest-lottery.html` แบบไม่มี hash เดิมคือหน้าสลากกินแบ่ง บุ๊กมาร์กเดิมต้องเปิดเนื้อหาเดิม) — เมนูลิงก์พร้อม hash เสมอ จึงไม่มีผลกับการเปิดจากเมนู
- สลับแท็บด้วย `history.replaceState` (ไม่เพิ่มประวัติ back) + ฟัง `hashchange`
- โหลดโค้ด/ข้อมูลของแท็บเมื่อเปิดแท็บครั้งแรก (lazy init) — แท็บที่ไม่ได้เปิดไม่ยิงเน็ต
- `?sym=` ใช้กับแท็บ `th`/`us` ของหน้าหุ้น (เหมือน `invest-thai-stock.html?sym=` เดิม)

**สิ่งที่ย้าย/ตัดในแต่ละหน้า**
- หน้าหุ้น `#th`/`#us`: ไม่มีการ์ด Expectancy, ไม่มีสมุดเทรด (ปุ่ม "สมุดเทรด" ลิงก์ไป `invest-trade-journal.html#th|#us`), ไม่มี Drive, ไม่มีโหมด embed · ตาราง "หุ้นดัง (US)" + ปุ่มสแกนของหุ้นนอกย้ายไป `#scan` (สลับ SET50 / US)
- `#paper`: เหมือนพอร์ตจำลองเดิมทุกฟีเจอร์ ยกเว้น Drive
- กองทุน `#th`: การ์ดภาษีใช้ `TaxCalc.simulate(rules, inp, {rmf, ssf, thaiEsg})` กับปีภาษีจาก `tax-rules/index.json` + ปุ่ม `tax.html#sim` · แผนภาษีหลายปีเดิมคิดด้วยกฎปีล่าสุดที่มี (ไม่เดาเพดานปีอนาคต) · "วันพร้อมขาย" ยังใช้จำนวนปีถือครองเดิม (RMF 5 ปี + อายุ 55, SSF 10 ปี, ESG 5/8 ปี) แต่ย้ายตารางไป `InvestCalc.HOLD_RULES` พร้อมคอมเมนต์ที่มา
- กองทุน: ช่อง "NAV ล่าสุด" (`lgCur` เดิมไม่บันทึก) **บันทึก**ลงคีย์ใหม่ `tanot:invest:nav` เพื่อให้มูลค่าสินทรัพย์ใช้ได้ (ดู 3.2)
- ทอง `#gold`: ไม่มีการ์ดสัดส่วนทอง, ไม่มี Drive · `#markets`: เนื้อหาหน้าค่าเงินเดิมทั้งหมด (ทองไทยในหน้านี้ใช้แคช/ฟังก์ชันเดียวกับ `#gold`)
- Bitcoin: สมุดเทรดย้ายไปหน้าสมุดเทรด (ลิงก์ `#btc`), ไม่มี Drive
- สมุดเทรด: ดู 3.3
- หน้ารวม: ดู 6 + 7
- ทุกหน้า: เมื่อแตะหน้าใดให้ลบข้อความอธิบายที่หลงเหลือตามกฎ CLAUDE.md (เช่น `aiFallback`, ข้อความ hint) — คงไว้เฉพาะข้อความสถานะ/empty state/validation

---

## 3. ข้อกำหนดข้อมูล (สำคัญที่สุด)

### 3.1 กฎเหล็ก
1. **ทุกคีย์ในตาราง 1.2 ใช้ชื่อเดิม รูปแบบเดิม ฟิลด์เดิม** — หน้าใหม่อ่าน/เขียนคีย์เดิมตรงๆ ไม่มีคีย์ "v2"
2. แถวใหม่ที่หน้าใหม่เขียนต้องมีฟิลด์ครบเท่าที่หน้าเดิมเขียน (เช่น `thjournal` ต้องมี `pl` เพราะหน้าอื่นอ่าน `r.pl`; `thaifund` ต้องมี `cat/amt/ts` เพราะ `tax.js` อ่าน) · แบบนี้ไม่ต้องเพิ่มฟิลด์ใหม่ในคีย์เดิมเลย ถ้าระหว่างลงมือคิดว่าต้องเพิ่ม ให้หยุดถามเจ้าของก่อน
3. แก้แถวที่มีอยู่ = แก้เฉพาะฟิลด์ที่ผู้ใช้แก้ คงฟิลด์อื่นไว้ (รวมฟิลด์ที่หน้าใหม่ไม่รู้จัก)
4. การเขียนคีย์ list (`thstock`, `thjournal`, … `bizplan`): `localStorage.getItem` สด → แก้ → `setItem` ทุกครั้ง **ห้ามถืออาร์เรย์ค้างในหน่วยความจำ** · ลบ = กรองด้วย `ts` (ไม่ใช้ดัชนี) · หน้าที่เขียนคีย์เหล่านี้ตั้ง `window.TANOT_NO_RELOAD_BAR = true` และวาดใหม่เองใน `TanotData.onChange` (แบบเดียวกับ `car.js`/`receipts.js` — tanot-data จะรู้ว่าหน้านี้เห็นแถวจากอีกเครื่องแล้ว ลบแล้วไม่ถูก merge กลับ)
5. หน้าที่อ่านอย่างเดียว (หน้ารวม, `index.js`) อ่านผ่าน `TanotData.read` เท่านั้น
6. `tanot:invest:portfolio` (blob) เขียนทั้งก้อนแบบเดิม — ไม่เปลี่ยนเป็น list
7. **ไม่มีการย้ายข้อมูล (migration) ในงานนี้** — ไม่มีเหตุผลที่ต้องย้าย: สมุดเทรด 3 คีย์แสดงรวมได้จากคีย์เดิม, หน้า/แท็บใหม่ใช้คีย์เดิมได้ทุกตัว ถ้าระหว่างลงมือเจอเหตุให้ต้องย้ายจริง ต้องหยุดถามเจ้าของ และแผนย้ายต้อง: รันซ้ำได้ (idempotent), ไม่ลบคีย์เดิม, ย้อนกลับได้โดยแค่ revert โค้ด
8. คีย์ที่เลิกใช้ (`hub:history`, `*:driveConnected`, ไฟล์ Drive 5 ไฟล์) **ไม่ลบ** — ปล่อยไว้เฉยๆ (`hub:history` มีเงินสมมติปน จึงไม่นำมาต่อกราฟใหม่)

### 3.2 คีย์ใหม่ (ทุกตัวต้องเพิ่มกฎใน `data-registry.js` **เหนือ** `{ prefix: 'tanot:' }`)

| คีย์ | registry | รูปแบบ | ใช้ทำอะไร |
|---|---|---|---|
| `tanot:invest:ui` | local | `{tabs: {stock: 'th', fund: 'th', gold: 'gold', journal: 'all', lottery: 'govt'}, chartRange: '90d', cleaned: 1}` | แท็บล่าสุด/ช่วงกราฟ/ธงล้างแคชเก่า (3.5) |
| `tanot:invest:nav` | sync map | `{'th:<ชื่อกองทุน>': {nav, d: 'YYYY-MM-DD', ts}, 'global:<cls>': {…}}` | NAV ล่าสุดที่ผู้ใช้กรอก (กองทุนไม่มีราคาตลาดฟรี) — map เพราะแต่ละกองทุนแก้แยกกันจากหลายเครื่องได้ |
| `tanot:invest:networth` | sync list idField `d` | `[{d: 'YYYY-MM-DD' (เวลาไทย), v, c, parts: {stockTh, stockUs, crypto, gold, fundTh, fundGlobal, bond, savingsLottery}, fx, n, ts}]` | snapshot มูลค่าสินทรัพย์วันละแถว (ดู 6.4) — 2 เครื่องเขียนวันเดียวกัน = แถวเดียว (แก้ทีหลังชนะ) |

คีย์แคชใหม่อยู่ใต้ `tanot:invest:cache:` ซึ่งเป็น cache อยู่แล้ว ไม่ต้องเพิ่มกฎ

### 3.3 สมุดเทรดรวม (`invest-trade-journal.html`)

อ่านคีย์เดิม 3 คีย์แล้ว normalize ใน `InvestCalc.journalRows(th, us, btc)`:

```
{ market: 'th'|'us'|'btc', key: '<คีย์ต้นทาง>', ts, sym: r.sym || 'BTC', entry: r.en, exit: r.ex,
  qty: r.sh (th/us) | r.qty (btc), pl: r.pl, ccy: 'THB'|'USD' }
```

- แท็บ `#th/#us/#btc` = สถิติ (จำนวนไม้, อัตราชนะ, P/L รวม, expectancy ต่อไม้ — สูตรเดิมของ `renderJournal`) ในสกุลเงินของตลาดนั้น
- `#all` = นับไม้/อัตราชนะรวมทุกตลาด, P/L แยกตามสกุล (฿ และ $) + บรรทัดรวมเป็นบาท `≈` ด้วยอัตรา USD/THB ล่าสุด (ไม่มีอัตรา = ไม่แสดงบรรทัดรวม)
- เพิ่มไม้: เลือกตลาดในฟอร์ม (ค่าเริ่ม = แท็บที่เปิด, `#all` → th) แล้วเขียน**รูปแบบเดิมของคีย์นั้นตรงตัว**:
  - th / us → `{sym, en, ex, sh, pl: (ex - en) * sh, ts: Date.now()}`
  - btc → `{en, ex, qty, pl: (ex - en) * qty, ts: Date.now()}` (ไม่มี `sym` เหมือนเดิม)
- ลบ: กรองด้วย `ts` ในคีย์ต้นทาง (`key`) ของแถวนั้นเท่านั้น
- ไม่มี Drive

### 3.4 สิ่งที่หน้าอื่นต้องยังทำงานเหมือนเดิม
- `tax.js` `fundSums()` อ่าน `tanot:invest:thaifund` ได้เหมือนเดิม (หน้ากองทุนใหม่เขียน `{fund, cat, amt, nav, units: amt/nav, ts}` ทุกฟิลด์)
- `tax.js` เพิ่มการอ่าน `location.hash === '#sim'` ตอนเปิดหน้าเพื่อเปิดแท็บ "ถ้าซื้อเพิ่ม" (ปัจจุบันจำแท็บใน `tanot:tax:ui` อย่างเดียว ไม่มี hash) — แก้เล็กน้อย 2–3 บรรทัด
- `index.js` ต้องอ่านราคาจากแคชที่หน้าใหม่เขียนได้ (คงชื่อ series cache เดิม ดู 3.5)

### 3.5 คีย์แคช

**คงชื่อ series cache เดิม** (ไม่ต้องย้ายอะไร และ `index.js`/`today.spec.js`/`ai.spec.js` ใช้ต่อได้) ผ่านตารางเดียวใน `InvestCore.seriesKey(yahooSym)`:

| สัญลักษณ์ Yahoo | คีย์ series (`{ts, t, o, h, l, c, v}`) |
|---|---|
| `XXX.BK` | `tanot:invest:cache:XXX` (สแกนเนอร์เขียนครบทุกฟิลด์แล้ว ไม่ทับด้วยข้อมูลย่อ) |
| `BTC-USD` | `tanot:invest:cache:btc:BTC-USD` |
| `GC=F` | `tanot:invest:cache:gold:GC=F` |
| สัญลักษณ์ที่มี `=F`, `=X`, `^` หรือ `DX-Y.NYB` | `tanot:invest:cache:comm:s:<sym>` |
| อื่นๆ (หุ้น US) | `tanot:invest:cache:us:<sym>` |

**รวมเป็นชุดเดียว** (แคชอายุสั้น เปลี่ยนชื่อได้):

| ข้อมูล | คีย์ใหม่ | แทนที่ |
|---|---|---|
| quote ย่อ (5 วัน) ทุกสัญลักษณ์ | `tanot:invest:cache:q:<yahooSym>` = `{ts, price, prev, spark}` | `cache:hub:q:*`, `cache:comm:q:*`, `cache:gold:dxy\|tnx` |
| ราคาทองไทย | `tanot:invest:cache:gold:th` (คงชื่อ/รูปแบบเดิมของหน้าทอง) | `cache:comm:thaigold` |
| กลัว-โลภ | `tanot:invest:cache:fng` = `{ts, value, classification}` | `cache:btc:fng`, `cache:hub:fng` |
| ข่าว | `tanot:invest:newscache:q:<query>` = `{ts, items}` | `newscache:<SYM>`, `newscache:us:<SYM>`, `newscache:hub:<q>` |
| อัตราแลกเปลี่ยน | `tanot:invest:fxcache` (คงเดิม) | — |
| สลากกินแบ่ง | `lottery:cache`, `lottery:latest` (คงเดิม) | — |
| UI ล่าสุด | `comm:lastKey`, `news:lastChip` (คงเดิม) | — |

**ล้างแคชเก่าที่ไม่มีใครใช้แล้ว** ครั้งเดียวต่อเครื่อง (`InvestCore` ตอนโหลด ถ้า `tanot:invest:ui.cleaned` ยังไม่ตั้ง): ลบคีย์ที่ขึ้นต้น `tanot:invest:cache:hub:`, `tanot:invest:cache:comm:q:`, `tanot:invest:newscache:` (ยกเว้น `newscache:q:`) และคีย์ `tanot:invest:cache:comm:thaigold`, `tanot:invest:cache:btc:fng`, `tanot:invest:cache:gold:dxy`, `tanot:invest:cache:gold:tnx` — **ก่อนลบทุกคีย์ต้องเช็ก `TanotRegistry.classify(k).kind === 'cache'`** ถ้าไม่ใช่ cache ห้ามลบ (กันพลาดลบข้อมูลผู้ใช้)

---

## 4. URL เดิม (redirect)

### 4.1 หน้า redirect (9 หน้า) — แบบเดียวกับ `documents.html`

```html
<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>หุ้นไทย | Tanot</title>
<meta name="robots" content="noindex, nofollow">
<meta http-equiv="refresh" content="0; url=invest-stock.html#th">
<script>location.replace('invest-stock.html' + location.search + '#th');</script>
</head>
<body><a href="invest-stock.html#th">หุ้นไทย</a></body>
</html>
```

- ส่ง `location.search` ต่อ (ให้ `?sym=` ใช้ได้) · hash ปลายทางตายตัวตามตาราง 2
- ไม่โหลด `theme.css`/`theme-boot.js`/`tanot-data.js` (repo-guards ข้อ 7–8 บังคับเฉพาะหน้าที่ใช้ `theme.css` — หน้า redirect ไม่ใช้)
- ไม่ใช้ `_redirects` ของ Cloudflare เพราะ: ออฟไลน์ (service worker) ใช้ไม่ได้, `python3 -m http.server` ในเทสต์ไม่รองรับ และ repo ใช้แบบ stub อยู่แล้ว
- ใช้ได้กับ: บุ๊กมาร์ก, แอปบนหน้าจอโฮมที่บันทึกหน้าเดิมไว้, ลิงก์จากหน้าอื่น, ประวัติค้นหาด่วน · GitHub Pages (`github-pages-redirect.mjs`) สร้าง stub ของทุก `.html` อยู่แล้ว → ไป pages.dev แล้ว redirect ต่ออีกทอด ไม่ต้องแก้สคริปต์
- Pages ตัด `.html` ออกจาก URL (`/invest-thai-stock` ) — ลิงก์แบบ relative ใน stub ยังถูก

### 4.2 `sw.js`
- bump `CACHE` ทุกขั้นที่แตะไฟล์ลงทุน
- PRECACHE: **คง** stub ทั้ง 9 หน้า (เล็กมาก ทำให้บุ๊กมาร์กเดิมเปิดออฟไลน์ได้) · **เพิ่ม** `invest-core.js`, `invest-calc.js`, `invest-hub.js`, `invest-stock.html/js`, `invest-scan.js`, `invest-paper.js`, `invest-fund.html/js`, `invest-markets.js`, `invest-savings-lottery.js` · **ลบ** JS ที่ไม่มีแล้ว: `invest-thai-stock.js`, `invest-global-stock.js`, `invest-set50-scanner.js`, `invest-portfolio.js`, `invest-thai-fund.js`, `invest-global-fund.js`, `invest-commodities.js`, `invest-gsb-lottery.js`, `invest-baac-lottery.js`, `invest-drivesync.js`
- `tests/repo-guards.mjs` เช็กว่าทุกไฟล์ใน PRECACHE มีจริง — ลบไฟล์กับแก้ PRECACHE ต้องอยู่ commit เดียวกัน

---

## 5. `invest-calc.js` + `invest-core.js`

### 5.1 `invest-calc.js` — ตรรกะล้วน (UMD, `window.InvestCalc`, ไม่มี DOM/storage/network, `require()` ได้)

```
// อินดิเคเตอร์ (ย้ายจากหุ้นไทยตรงตัว — ห้ามแก้สูตร)
sma, smaSeries, emaSeries, emaLast, rsi, rsiSeries, macd, bollinger, atr, supRes, adx, psar
toSeries(times, opens, highs, lows, closes, volumes), parseYahoo(json), parseQuoteLite(json), parsePaste(text)

// วิเคราะห์ → คืน "รหัสเหตุผล" แทนข้อความ หน้าแปลงเป็นข้อความเอง (ตารางรหัส→คีย์ i18n ต่อหน้า)
analyzeSeries(s, {psar: true|false}) -> {light, score, reasons: [{code, sign}], pros: [code], cons: [code],
                                         price, suggestStop, resistance, support, uptrend, rsi, adx, psar, det}
   // code: 'cheapRange'|'expensiveRange'|'rsiLow'|'rsiHigh'|'momUp'|'momDn'|'uptrend'|'downtrend'|'bbLow'|'bbHigh'|'neutral'
analyzeSimple(price, hi, lo)
sellVerdict(a) -> {cls, code, levels}

// คุมเงิน — 4 แบบเดิม แยกตามตลาด (ห้ามรวมสูตร)
riskCalc.th(o)   // ล็อต 100 + ค่าคอมขั้นต่ำ/วัน
riskCalc.us(o)   // หุ้นเดี่ยว USD
riskCalc.btc(o)  // เศษส่วน
riskCalc.gold(o) // บาท
checklist.th|us|btc|gold|markets(ctx) -> [{ok: true|false|null, code, vars}]

// DCA / ตราสาร / สลาก (ย้ายตรงตัว)
simulateDCA(...), fundPlan(...), bondPV, solveYTM, couponSchedule, compareDeposit,
drawSchedule, evPerUnitPerDraw, totalExpectedReturn, …, addMonths, parseYMD, ymd
HOLD_RULES  // ปีถือครอง RMF/SSF/ESG (ที่มาในคอมเมนต์) ใช้กับ "วันพร้อมขาย"

// สมุดเทรด
journalRows(th, us, btc), journalStats(rows)

// มูลค่าสินทรัพย์ (หัวข้อ 6)
thaiDate(ms), CLASSES, collectPrices(read, data), netWorth(data, prices, fx, now),
snapshotRow(nw, now), shouldWriteSnapshot(prevRow, row, now)
GRAM_PER_BAHT = 15.244
```

ความถูกต้อง: สูตรอินดิเคเตอร์/คะแนนไฟจราจร/riskCalc ต้องให้ผลเท่าเดิมทุกหลัก → ก่อนลบไฟล์เดิม คัดลอกฟังก์ชันล้วนเดิม (หุ้นไทย/นอก/BTC/ทอง/สแกนเนอร์/กองทุน/พันธบัตร/สลาก) แบบไม่แก้เลยไปไว้ที่ `tests/fixtures/invest-original.js` แล้วเทสต์เทียบผล (แบบเดียวกับ `fsrs-original.js` — ห้ามแก้ fixture)

### 5.2 `invest-core.js` — ส่วนกลางฝั่งเบราว์เซอร์ (`window.InvestCore`)

```
// เครือข่าย — ผ่าน /api/proxy เท่านั้น (+ fetch ตรงเฉพาะ API ที่เปิด CORS เอง)
proxied(url) -> '/api/proxy?url=' + encodeURIComponent(url)
fetchText(url, {timeout = 8000, direct = false})   // direct: ลองตรงก่อนแล้วค่อย proxy
series(yahooSym, {range: '1y'}) -> Promise<{series, stale, cachedAt}>   // เขียน seriesKey()
quote(yahooSym)                 -> Promise<{price, prev, spark, ts, stale}> // เขียน cache:q:
fx('USD')                       -> Promise<{rate, ts, stale}>              // THB=X, fxcache
thaiGold()                      -> Promise<{barBuyPrice, barSellPrice, jewelryBuyPrice, jewelrySellPrice, updateDate, ts, stale}>
fng()                           -> Promise<{value, classification, ts, stale}>
news(query, {limit})            -> Promise<{items, stale}>                 // Google News RSS
seriesKey(yahooSym), quoteKey(yahooSym)

// Live Gateway / Twelve Data (เก็บไว้ตามที่เจ้าของเลือก — คีย์เดิม tanot:market:live-config:v1)
live.cfg(), live.save(c), live.quote(yahooSym, market), live.start(sym, onQuote), live.stop(),
live.openSettings()   // <dialog class="dialog"> เดียว ใช้ทุกหน้าที่มีราคาสด (หุ้น th/us, BTC)

// AI — คลาวด์อย่างเดียว
summarize({task, messages}) -> Promise<text>   // AiClient.summarize, task เดิม (stock:thaistock ฯลฯ) ให้แคช D1 เดิมยังโดน
   // ไม่มี AiClient / ไม่ใช่ pages.dev → ปุ่มสรุปซ่อน · ล้มเหลว → AiClient.friendlyMessage(err) ไม่สร้าง ai-chat-worker
stripLeaked(text)

// UI
i18n(dict) -> t(key, vars)    // อ่าน ome:lang + ลงทะเบียน window.omeApplyLang ร่วม
applyStatic(t)
num, fmt(n, d), money(n, 'THB'|'USD', d), pct(n, d), ago(ts)
tabs({el, page, tabs: [...], def, onShow})   // กติกาหัวข้อ 2
subnav(el, activeKey)   // จาก window.INVEST_CATS
renderChecklist(el, checks, t)
cleanupLegacyCache()    // หัวข้อ 3.5
```

- ทุกฟังก์ชันที่ดึงเน็ต: สำเร็จ → เขียนแคช; ล้มเหลว → คืนแคชพร้อม `stale: true`; ไม่มีแคช → reject แล้วหน้าแสดงช่องกรอกเอง/วางราคาเอง (ห้ามแสดง error แข็ง) — เหมือนกฎเดิมใน CLAUDE.md
- dedupe คำขอสัญลักษณ์เดียวกันที่ยิงพร้อมกัน (แบบ `quotePromises` ของหน้าค่าเงิน) + หน่วง 260 ms ต่อสัญลักษณ์เมื่อยิงเป็นชุด (แบบหน้ารวม)
- `marketLikelyOpen()` ของหน้ารวม (ไม่ยิงซ้ำตอนตลาดปิดถ้ามีแคช) ย้ายมาใช้ใน `quote()`

### 5.3 proxy — ตัดสินใจแล้ว: `/api/proxy` อย่างเดียว

- ลบ `OWN_PROXY` ที่ชี้ `tanot-cors-proxy.tanot713.workers.dev` (Worker ถูกลบแล้ว 2026-10-02) และ public proxy ทั้ง 5 + rss2json ออกจากทุกไฟล์
- `functions/api/proxy.js` เพิ่ม `api.chnwt.dev` ใน `ALLOWED_HOSTS` (ทองไทย: ลองตรงก่อน เพราะ API เปิด CORS เอง แล้วค่อย proxy)
- ยิงตรงโดยไม่ผ่าน proxy: `api.alternative.me` (ลองตรงก่อนแล้วค่อย proxy), `raw.githubusercontent.com` (สลากกินแบ่ง — ตรงอย่างเดียวเหมือนเดิม), `api.twelvedata.com`/Gateway ของผู้ใช้ (Live)
- นอก `*.pages.dev` (เช่น `python3 -m http.server` ตอนทดสอบ) `/api/proxy` ไม่มี → ได้แคช/กรอกเอง ซึ่งเป็นพฤติกรรมที่ต้องการอยู่แล้ว (เทสต์ seed แคช)
- ข้อเสียที่ยอมรับ: ตอน Cloudflare Access หมดอายุ ราคาสดดึงไม่ได้ (`sw.js` มีแถบล็อกอินใหม่อยู่แล้ว)
- CLAUDE.md ย่อหน้า "Client-side-only, no backend" ต้องแก้ให้ตรง (ขั้นสุดท้าย)

---

## 6. มูลค่าสินทรัพย์ลงทุน

ชื่อที่แสดง: **"สินทรัพย์ลงทุน"** (ไม่ใช้คำว่า "สุทธิ" เพราะขอบเขตที่เลือกไม่หักหนี้) — เจ้าของเปลี่ยนชื่อได้ภายหลัง

### 6.1 ประเภทสินทรัพย์ (ลำดับคงที่ = ลำดับสีกราฟ `--ome-chart-1..8`)

| # | class | แหล่ง | จำนวน | ต้นทุน (สกุลเดิม) | ราคาตลาด (ลำดับความสำคัญ) | สกุล |
|---|---|---|---|---|---|---|
| 1 | `stockTh` | `thstock` รวมตาม `sym` | Σ`shares` | Σ`shares×cost` | ราคาแคชล่าสุด `XXX.BK` → `cur` ของแถวล่าสุดที่มี → ต้นทุนเฉลี่ย | THB |
| 2 | `stockUs` | `globalstock` รวมตาม `sym` | Σ`shares` | Σ`shares×cost` | แคช `XXX` → `cur` → ต้นทุนเฉลี่ย | USD |
| 3 | `crypto` | `btc` | Σ`qty` | Σ`qty×cost` | แคช `BTC-USD` → `cur` → ต้นทุนเฉลี่ย | USD |
| 4 | `gold` | `gold` แยก `type` | Σ น้ำหนักบาททองคำ (`unit === 'gram'` → `weight / 15.244`) | Σ`amt` | ทองแท่ง: `barSellPrice` (ราคาร้านรับซื้อ) · รูปพรรณ: `jewelrySellPrice` จาก `cache:gold:th` → ต้นทุน | THB |
| 5 | `fundTh` | `thaifund` รวมตาม `fund` | Σ`units` | Σ`amt` | `nav['th:'+fund].nav` → ต้นทุน | THB |
| 6 | `fundGlobal` | `spfund` รวมตาม `cls` | Σ`units` | Σ`amt` | `nav['global:'+cls].nav` → ต้นทุน | THB |
| 7 | `bond` | `govbond` ที่ `maturity` > วันนี้ (เวลาไทย) | — | `face` | ไม่มีราคาตลาด → `face` | THB |
| 8 | `savingsLottery` | `gsblottery` + `baaclottery` ที่ `maturity` > วันนี้ | `units` | `unitPrice×units` | ไม่มีราคาตลาด → ต้นทุน | THB |

ไม่นับ: `portfolio` (เงินสมมติ), `bizplan`, สมุดเทรด (เป็นผลที่ปิดไปแล้ว), สลากกินแบ่ง (ไม่มีเงินต้นคืน), พันธบัตร/สลากที่ครบกำหนดแล้ว (ถือว่าได้เงินคืนไปแล้ว — แสดงจำนวนรายการที่ครบกำหนดแยกไว้ในหน้ารวม)

### 6.2 ราคา/อัตราแลกเปลี่ยน
- `InvestCalc.collectPrices(read, data)` (pure — รับฟังก์ชันอ่านคีย์เข้ามา) อ่านจากแคช **ไม่ยิงเน็ต**: สำหรับแต่ละสัญลักษณ์ เทียบ `cache:q:<sym>` (`price`, `ts`) กับ series cache (`c[c.length-1]`, `ts`) แล้วเลือกที่ `ts` ใหม่กว่า · คืน `{ '<yahooSym>': {price, ts, src: 'market'} }` + `thaiGold` + `nav` + `fx`
- `fx` = `tanot:invest:fxcache.rate` (หรือ `cache:q:THB=X` ถ้าใหม่กว่า) · **ไม่มีอัตรา = แถว USD ไม่นับรวมยอดบาท** และตั้ง `missingFx: true` (ห้ามใช้ค่าเดา)
- แต่ละแถวเก็บ `src: 'market'|'manual'|'cost'` และ `priceTs` · ราคาตลาดเก่ากว่า 3 วัน → `stale: true` (ยังใช้ แต่หน้าแสดง "ณ วันที่")

### 6.3 สูตร

```
valueCcy(row) = qty × price             (gold: น้ำหนักบาททองคำ × ราคา/บาททองคำ)
valueThb(row) = valueCcy × (ccy === 'USD' ? fx : 1)        // fx ไม่มี → null, ไม่นับ
costThb(row)  = costCcy  × (ccy === 'USD' ? fx : 1)
total = Σ valueThb (ไม่ null) · cost = Σ costThb (ไม่ null) · pl = total − cost · plPct = pl / cost × 100
byClass[c] = {value, cost, n}
```
ไม่ปัดเศษระหว่างคำนวณ ปัดตอนแสดงผลเท่านั้น

### 6.4 ตัวอย่าง known-answer (ใช้เป็นเทสต์ตรงตัว)

ข้อมูล (now = `2026-10-03T03:00:00Z` = 10:00 เวลาไทย):
- `thstock`: `[{sym:'PTT', shares:200, cost:32, ts:1}, {sym:'PTT', shares:100, cost:36, ts:2}, {sym:'AOT', shares:500, cost:60, ts:3, cur:58}]` · แคช `tanot:invest:cache:PTT` = `{ts: now, c:[30,31,32,34.5]}` · AOT ไม่มีแคช
- `globalstock`: `[{sym:'AAPL', shares:3, cost:150, ts:4}]` · `cache:q:AAPL` = `{ts: now, price: 200}`
- `btc`: `[{qty:0.01, cost:60000, ts:5}]` · `cache:q:BTC-USD` = `{ts: now, price: 100000}`
- `fxcache` = `{ts: now, rate: 36.5}`
- `gold`: `[{type:'bar', unit:'baht', amt:40000, price:40000, weight:1, ts:6}, {type:'jewelry', unit:'gram', amt:21000, price:2755.18, weight:7.622, ts:7}]` · `cache:gold:th` = `{barSellPrice: 42000, jewelrySellPrice: 41000, ts: now}`
- `thaifund`: `[{fund:'K-RMF', cat:'rmf', amt:10000, nav:10, units:1000, ts:8}]` · `nav` = `{'th:K-RMF': {nav: 11, d:'2026-10-02'}}`
- `spfund`: `[{cls:'สะสมมูลค่า', amt:5000, nav:20, units:250, ts:9}]` (ไม่มี NAV)
- `govbond`: `[{name:'LB30', purchDate:'2025-01-01', maturity:'2030-01-01', face:100000, coupon:3, freq:2, ts:10}, {name:'LB26', purchDate:'2024-01-01', maturity:'2026-01-01', face:50000, coupon:2.5, freq:2, ts:11}]`
- `gsblottery`: `[{name:'ออมสิน 3 ปี', purchDate:'2025-01-01', maturity:'2028-01-01', unitPrice:100, units:200, drawFreq:'16', evPerDraw:0, results:{}, ts:12}]` · `baaclottery`: `[]`
- `portfolio`: `{cash: 1000000, startCash: 1000000, holdings: [{sym:'PTT', shares:1000, avgCost:30}], tx: []}` (ต้องไม่ถูกนับ)

ผลที่ต้องได้:

| class | value (฿) | cost (฿) | หมายเหตุ |
|---|---|---|---|
| stockTh | 39,350 | 40,000 | PTT 300×34.5 = 10,350 (market) · AOT 500×58 = 29,000 (manual) |
| stockUs | 21,900 | 16,425 | 3×200×36.5 · 450×36.5 |
| crypto | 36,500 | 21,900 | 0.01×100000×36.5 · 600×36.5 |
| gold | 62,500 | 61,000 | แท่ง 1×42,000 · รูปพรรณ 7.622/15.244 = 0.5 × 41,000 = 20,500 |
| fundTh | 11,000 | 10,000 | 1000×11 |
| fundGlobal | 5,000 | 5,000 | ต้นทุน (src cost) |
| bond | 100,000 | 100,000 | LB26 ครบกำหนดแล้ว ไม่นับ |
| savingsLottery | 20,000 | 20,000 | 100×200 |
| **รวม** | **296,250** | **274,325** | P/L **21,925** (**7.99%**) |

กรณีไม่มีอัตราแลกเปลี่ยน (ลบ `fxcache` และ `cache:q:THB=X`): total = **237,850**, cost = **236,000**, `missingFx: true`, แถว stockUs/crypto `valueThb: null`

### 6.5 snapshot วันละครั้ง (`tanot:invest:networth`)
- `snapshotRow(nw, now)` → `{d: thaiDate(now), v: round2(total), c: round2(cost), parts: {class: round2(value)}, fx, n: จำนวนแถวที่นับ, ts: now}`
- `thaiDate(ms)` = `new Date(ms + 7*3600000).toISOString().slice(0, 10)` (เวลาไทยเสมอ ไม่ใช่เวลาเครื่อง/UTC)
- `shouldWriteSnapshot(prev, row, now)`: เขียนเมื่อยังไม่มีแถวของวันนั้น หรือ (`|row.v − prev.v| / prev.v ≥ 0.001` และ `now − prev.ts ≥ 1 ชม.`) · ไม่มีสินทรัพย์เลย (`n === 0`) = ไม่เขียน
- ผู้เขียน: `index.js` (หน้าวันนี้) และ `invest-hub.js` ทุกครั้งที่วาดการ์ด — ผ่าน `TanotData.update('tanot:invest:networth', fn)` (อ่านสด → แทนแถว `d` เดิม/ต่อท้าย) **ไม่ลบแถวเก่า** (≈150 ไบต์/วัน ≈ 55 KB/ปี)
- หน้าวันนี้ยังไม่ยิงเน็ตเหมือนเดิม — แค่เขียน localStorage หนึ่งคีย์ (ข้อยกเว้นจาก "อ่านอย่างเดียว" ที่ตั้งใจ ต้องแก้หัวไฟล์ `index.js` และ CLAUDE.md ให้ตรง)
- หน้าวันนี้โหลด `invest-calc.js` เพิ่ม (แบบเดียวกับ `insurance-calc.js`)

### 6.6 การ์ดบนหน้าวันนี้ (แทนการ์ด "หุ้นที่ติดตาม")
- หัว "สินทรัพย์ลงทุน" + ปุ่ม "การลงทุน" → `invest.html`
- ยอดรวม ฿ (ตัวใหญ่) · P/L เทียบต้นทุน (฿ และ %) · เปลี่ยนแปลงเทียบ snapshot ≥ 30 วันก่อน (ถ้ามี)
- แถบสัดส่วนตาม class (สี chart-1..8 ตามลำดับ 6.1)
- รายการสูงสุด 4 แถวตามมูลค่า (สัญลักษณ์/ชื่อ · มูลค่า · P/L %) — ลิงก์ไปหน้า/แท็บของแถวนั้น
- badge เตือนเฉพาะเมื่อเกิดจริง: `missingFx` → "ไม่รวมสินทรัพย์ USD (ยังไม่มีอัตราแลกเปลี่ยน)", ราคาเก่า → "ราคา ณ <วันที่>"
- ไม่มีสินทรัพย์ → `emptyHtml('trending-up', 'ยังไม่มีสินทรัพย์ลงทุน', 'invest.html', 'เปิดหน้าการลงทุน')`

### 6.7 หน้ารวม `invest.html`
- KPI: สินทรัพย์ลงทุน · กำไร/ขาดทุนเทียบต้นทุน · เปลี่ยนแปลง 30 วัน · จำนวนรายการ (+ ครบกำหนดแล้ว)
- กราฟ snapshot (SVG สีจาก `OmeChartTheme.get()` วาดใหม่ตอน `onChange`) ช่วง 30 วัน / 90 วัน / 1 ปี / ทั้งหมด (`.segmented`, จำใน `tanot:invest:ui.chartRange`) · มีแถวเดียว = empty state
- ตารางสินทรัพย์ทุก class (คอลัมน์: สินทรัพย์ · จำนวน · มูลค่า ฿ · สัดส่วน · P/L · แหล่งราคา) คลิกแถวไปหน้า/แท็บ
- สัดส่วนตาม class (donut)
- ตลาด 3 กลุ่ม + ฟันเฟืองเลือกสัญลักษณ์ (คงคีย์ `hub:watch:*`) — คลิกหุ้นไทย/US ไป `invest-stock.html?sym=X#th|#us`
- ข่าว 3 ข่าว (`InvestCore.news`) + กลัว-โลภ (`InvestCore.fng`)
- ปุ่ม "รีเฟรชราคา" ดึง quote ของทุกสินทรัพย์ที่ถือ + FX + ทองไทย แล้ววาดใหม่ + เขียน snapshot
- ตัด: AI ลอย, ป๊อปอัพ iframe, ช่องค้นหา, Health, รายการที่ต้องทำ, การรวมพอร์ตจำลอง, เครื่องมือด่วน (ลิงก์ซ้ำกับแถบหมวดย่อย)

---

## 7. เมนู, หน้ารวมด้านการเงิน, ภาพที่เปลี่ยน

### 7.1 `shell.js`
`invest.children` เหลือ 9 รายการ (ไม่นับหน้ารวมเพราะเป็น href ของตัว `invest` เอง) แต่ละรายการมี `tabs` สำหรับค้นหาด่วน:

```js
{ key: 'stock', label: 'หุ้น', href: 'invest-stock.html#th', keywords: 'หุ้น stock set us',
  tabs: [ { key: 'thai-stock', label: 'หุ้นไทย', hash: 'th', keywords: 'หุ้นไทย set' },
          { key: 'global-stock', label: 'หุ้นต่างประเทศ', hash: 'us', keywords: 'หุ้นนอก us nasdaq' },
          { key: 'set50-scanner', label: 'สแกนเนอร์หุ้น', hash: 'scan', keywords: 'สแกน set50 scanner' },
          { key: 'portfolio', label: 'พอร์ตจำลอง', hash: 'paper', keywords: 'พอร์ตจำลอง ฝึกเทรด paper' } ] },
{ key: 'fund', label: 'กองทุน', href: 'invest-fund.html#th', tabs: [ไทย #th (rmf ssf thaiesg), ต่างประเทศ #global (s&p500)] },
{ key: 'gold', label: 'ทอง & สินค้าโภคภัณฑ์', href: 'invest-gold.html#gold', tabs: [ทองคำ #gold, ค่าเงิน & วัตถุดิบ #markets] },
{ key: 'bitcoin', label: 'คริปโต (Bitcoin)', href: 'invest-bitcoin.html' },
{ key: 'gov-bond', label: 'พันธบัตรรัฐบาล', href: 'invest-gov-bond.html' },
{ key: 'lottery', label: 'สลาก', href: 'invest-lottery.html#gsb', tabs: [ออมสิน #gsb, ธ.ก.ส. #baac, สลากกินแบ่ง #govt] },
{ key: 'journal', label: 'สมุดเทรด', href: 'invest-trade-journal.html#all' },
{ key: 'news', label: 'ข่าวหุ้น', href: 'invest-news.html' },
{ key: 'business', label: 'ลงทุนทำธุรกิจ', href: 'invest-business.html' }
```

- เมนูลิ้นชักแสดงเฉพาะรายการหน้า (ไม่แสดง `tabs`)
- `palette.js` เดิน `tabs` เพิ่มรายการ `{label: tab.label, href: page + '#' + tab.hash}` (ค้น "ออมสิน" แล้วไปแท็บได้ตรง)
- `hrefMatches()` เดิมเทียบ `HERE + location.hash` อยู่แล้ว · เพิ่ม: หน้าที่มีแท็บให้ถือว่า active เมื่อ path ตรงโดยไม่สน hash (ไม่งั้นเปิด `invest-stock.html#us` แล้วเมนู "หุ้น" (`#th`) ไม่ไฮไลต์)
- `window.INVEST_CATS` คงชื่อ/รูปแบบ `{key, label, icon, page}` (หน้าลงทุนใช้สร้างแถบหมวดย่อย) · แถบหมวดย่อยของหน้าลงทุนเหลือแถวเดียว 10 ลิงก์ (ภาพรวม + 9) ตัดปุ่มกลุ่ม 4 ปุ่มบนสุด ("ภาพรวม/ตลาด & สินทรัพย์/สลาก & พันธบัตร/ข่าว & ธุรกิจ") ที่ไม่มีความหมายแล้ว
- `tests/helpers.js` `menuPages()` ตัด hash อยู่แล้ว → smoke ทดสอบ 10 หน้าโดยอัตโนมัติ (รวมสมุดเทรดซึ่งเดิมไม่อยู่ในเมนู)

### 7.2 หน้ารวมด้านการเงิน (`area.html?a=life` → หมวด "การเงิน")
แสดงไทล์ของ `money.children` ที่มี href: รายรับรายจ่าย · ภาษี · ประกัน · การลงทุน — ไม่เปลี่ยน (ไทล์ "การลงทุน" ยังไป `invest.html`; `leaves()` ไม่แตกลูกของรายการที่มี href)

### 7.3 ภาพที่เปลี่ยนโดยตั้งใจ (อัปเดต baseline ใน commit ของขั้นนั้น)
| หน้า | เปลี่ยนอะไร |
|---|---|
| `index.html` | การ์ด "หุ้นที่ติดตาม" → "สินทรัพย์ลงทุน" |
| `invest.html` | KPI/กราฟ/ตารางใหม่, ไม่มี AI ลอย/ช่องค้นหา/Health/รายการที่ต้องทำ/เครื่องมือด่วน, แถบหมวดย่อยแถวเดียว |
| `invest-stock.html` | หน้าใหม่ (baseline ใหม่ 4 แท็บ: ภาพแท็บ `#th` เป็นหลัก) — ไม่มีการ์ด Expectancy/สมุดเทรด/Drive |
| `invest-fund.html` | หน้าใหม่ — การ์ดภาษีใช้ข้อมูลจาก TaxCalc |
| `invest-gold.html` | แถบแท็บ, ไม่มีการ์ดสัดส่วนทอง/Drive |
| `invest-bitcoin.html` | ไม่มีสมุดเทรด/Drive |
| `invest-lottery.html` | แถบแท็บ 3 แท็บ (ภาพแท็บ `#govt` = เนื้อหาเดิม) |
| `invest-trade-journal.html` | แถบแท็บ, ฟอร์มมีตัวเลือกตลาด, ไม่มี Drive |
| `invest-gov-bond/news/business` | แค่แถบหมวดย่อยใหม่ |
| ลบ baseline ของ 9 หน้าที่เป็น redirect | `visual.spec.js` เอาออกจากรายการ |

---

## 8. ลำดับงาน (1 ขั้น = 1 commit, push ทีละขั้นได้ เว็บใช้งานได้ทุกขั้น)

ทุกขั้นก่อน commit: `node --check` ทุกไฟล์ JS ที่แก้ · `cd tests && node repo-guards.mjs` · bump `sw.js` `CACHE` · `npx playwright test invest.spec.js smoke.spec.js` + `visual.spec.js` เฉพาะหน้าที่แตะ (อัปเดต baseline ที่ตั้งใจ) · เทสต์เดิมที่แตะคีย์ลงทุน (`today`, `tax`, `ai`) ต้องผ่าน

| ขั้น | งาน | ไฟล์หลัก |
|---|---|---|
| 1 | `invest-calc.js` + fixture เดิม `tests/fixtures/invest-original.js` + `tests/invest.spec.js` ส่วน known-answer (ยังไม่มีหน้าไหนใช้) | `invest-calc.js`, tests |
| 2 | `invest-core.js` + เพิ่ม `api.chnwt.dev` ใน `proxy.js` + กฎ registry (`ui`/`nav`/`networth`) + ย้าย **`invest-news`** มาใช้เป็นหน้านำร่อง (ตัด public proxy/rss2json) | `invest-core.js`, `functions/api/proxy.js`, `data-registry.js`, `invest-news.*` |
| 3 | มูลค่าสินทรัพย์: การ์ดหน้าวันนี้ + snapshot (`index.js` โหลด `invest-calc.js`) | `index.js`, `index.html`, `today.spec.js` |
| 4 | หน้ารวมใหม่ (`invest-hub.js`, ตัด 4 ฟีเจอร์ + พอร์ตจำลองออกจากยอด) | `invest.html`, `invest-hub.js` |
| 5 | สมุดเทรดรวม (อ่าน 3 คีย์, ลบด้วย `ts`, ไม่มี Drive) — หน้าหุ้นไทยเดิมยังใช้ `invest-drivesync.js` ต่อได้ในขั้นนี้ | `invest-trade-journal.*` |
| 6 | หน้าหุ้น `#th`/`#us` + redirect `invest-thai-stock`, `invest-global-stock` + ลบ `invest-drivesync.js` (ไม่มีใครใช้แล้ว) + ตัด Expectancy + กล่อง Live ใน core | `invest-stock.*`, stubs |
| 7 | แท็บ `#scan` (SET50 + US) + `#paper` + redirect `invest-set50-scanner`, `invest-portfolio` | `invest-scan.js`, `invest-paper.js`, stubs |
| 8 | หน้ากองทุน `#th`/`#global` + `tanot:invest:nav` + การ์ดภาษีด้วย `TaxCalc` + `tax.js` รองรับ `#sim` + redirect 2 หน้า | `invest-fund.*`, `tax.js`, stubs |
| 9 | ทอง `#gold` + `#markets` + redirect `invest-commodities` (ตัดสัดส่วนทอง/Drive, รูปพรรณใช้ราคารับซื้อรูปพรรณ) | `invest-gold.*`, `invest-markets.js`, stub |
| 10 | Bitcoin ย้ายมาใช้ core (ตัดสมุดเทรด/Drive/AI ในเบราว์เซอร์) | `invest-bitcoin.*` |
| 11 | สลาก `#gsb`/`#baac`/`#govt` + redirect 2 หน้า | `invest-lottery.*`, `invest-savings-lottery.js`, stubs |
| 12 | พันธบัตร + แผนธุรกิจ ย้ายมาใช้ core | `invest-gov-bond.*`, `invest-business.*` |
| 13 | เก็บกวาด: `shell.js` เมนู 9 รายการ + `tabs` + `palette.js` + active ตาม path, `cleanupLegacyCache()`, CLAUDE.md (หัวข้อ invest/proxy/Cloud AI/หน้าวันนี้/คีย์), ROADMAP ✅, ลบ baseline หน้า redirect | หลายไฟล์ |

หมายเหตุลำดับ: ขั้น 6–12 แต่ละขั้นต้องแก้ `shell.js` เฉพาะรายการของหน้านั้น (เปลี่ยน href จากหน้าเดิมไปหน้าใหม่) ไม่งั้น smoke ทดสอบหน้า redirect แทนหน้าจริง · ขั้น 13 จัดรูปเมนูสุดท้าย

### 8.1 เทสต์ที่ต้องเขียน — `tests/invest.spec.js` (พอร์ต **8138** สำหรับส่วนที่ใช้ `sync-server.mjs`; ส่วนที่เหลือใช้ static server)

**known-answer (node, `require('../invest-calc.js')`)**
1. อินดิเคเตอร์/`analyzeSeries`/`sellVerdict`/`riskCalc.*`/`checklist.*`/DCA/พันธบัตร/สลาก เทียบ `tests/fixtures/invest-original.js` บนชุดราคาสังเคราะห์ 3 แบบ (ขาขึ้น/ขาลง/แกว่ง) — ตัวเลขต้องเท่ากันทุกหลัก, light/score เท่ากัน, `reasons.code` ตรงกับคีย์ข้อความเดิมตามตารางแปลง
2. `netWorth` ตามตัวอย่าง 6.4 ทั้งกรณีมี/ไม่มี FX · ราคาเก่า → `stale` · `cur` ใช้เมื่อไม่มีแคช · แคช q ใหม่กว่า series → ใช้ q · พอร์ตจำลองไม่ถูกนับ
3. `thaiDate`: `2026-10-02T17:00:00Z` → `2026-10-03`, `2026-10-02T16:59:59Z` → `2026-10-02` · `shouldWriteSnapshot` ทุกกิ่ง
4. `journalRows`/`journalStats` บน 3 คีย์ (รวมแถว BTC ที่ไม่มี `sym`)

**หน้า (Playwright)**
5. **ทุกคีย์เดิมอ่านได้ครบหลังยุบ**: seed ทุกคีย์ในตาราง 1.2 ด้วยข้อมูลตัวแทน → เปิดหน้า/แท็บที่ใช้คีย์นั้น → ข้อมูลแสดงครบ → เพิ่มรายการผ่าน UI 1 แถว → อ่าน localStorage: แถวเดิม deep-equal ของเดิม, แถวใหม่มีชุดฟิลด์ตรงกับรูปแบบเดิม (เช็กชื่อฟิลด์ทุกตัว), ลบแถวใหม่ด้วย UI แล้วแถวเดิมยังอยู่ครบ
6. **หน้า redirect ทุกหน้า** (9 หน้า): ปลายทาง + แท็บที่ active ถูก · `invest-thai-stock.html?sym=PTT` → `invest-stock.html?sym=PTT#th` และช่องสัญลักษณ์เป็น PTT · มี `<meta http-equiv="refresh">` ชี้ปลายทางเดียวกัน (กรณีปิด JS) · ปลายทางมีอยู่จริงใน PRECACHE
7. **หน้าภาษียังเติมยอดกองทุนได้**: เพิ่มการซื้อ RMF/SSF/ESG ผ่านแท็บ `invest-fund.html#th` → เปิด `tax.html` → ช่อง RMF/SSF/ThaiESG ได้ยอดปีนี้ตรง · `tax.html#sim` เปิดแท็บ "ถ้าซื้อเพิ่ม" · การ์ดภาษีในแท็บกองทุนได้ตัวเลขเท่า `TaxCalc.simulate` ของปีเดียวกัน
8. **มูลค่าสินทรัพย์ known-answer บนหน้า**: seed ตาม 6.4 → การ์ดหน้าวันนี้แสดง ฿296,250 · P/L +฿21,925 (7.99%) · เขียน `tanot:invest:networth` 1 แถว `d: '2026-10-03'` (ตั้งนาฬิกาด้วย `page.clock`) · เปิดซ้ำวันเดียวกันไม่เพิ่มแถว · หน้ารวมแสดงยอดเดียวกัน · ไม่มี FX → ฿237,850 + badge
9. **ไม่ออกเน็ตนอกที่อนุญาต**: ดักทุก request ของหน้าลงทุนทั้ง 10 หน้า — ไม่มี host `allorigins`, `codetabs`, `cors.eu.org`, `cors.workers.dev`, `cors.lol`, `rss2json`, `tanot-cors-proxy`
10. **AI คลาวด์อย่างเดียว**: แก้เทสต์ใน `ai.spec.js` ที่ "คลาวด์ล่ม: คอมถอยไปโมเดลในเบราว์เซอร์" — หน้าลงทุนทั้งคอมและ iPhone ต้องแสดงข้อความ error และไม่สร้าง `ai-chat-worker` (หน้าอื่นที่ยังถอยได้ไม่เปลี่ยน) · task name เดิม (`stock:gold` ฯลฯ) ยังส่ง
11. **ซิงก์ 2 เครื่อง** (sync-server 8138): A ลบไม้ในสมุดเทรด (ตาม `ts`) ขณะ B เพิ่มไม้ใหม่ → ทั้งสองเครื่องได้ผลเดียวกัน แถวที่ลบไม่กลับมา · snapshot วันเดียวกันจาก 2 เครื่อง = 1 แถว
12. ล้างแคชเก่า: seed คีย์ `cache:hub:q:bk:PTT` + คีย์ข้อมูลผู้ใช้ทุกคีย์ → เปิดหน้าลงทุน → แคชเก่าหาย คีย์ข้อมูลผู้ใช้ไม่หายสักคีย์
13. แท็บ: hash → แท็บถูก, ไม่มี hash → แท็บล่าสุด, ครั้งแรกของ `invest-lottery.html` → `#govt`
14. แก้เทสต์เดิม: `today.spec.js` (การ์ดใหม่ — ใช้ seed เดิม `thstock`/`globalstock`/`cache:PTT`/`cache:us:AAPL` ต่อได้), `visual.spec.js` (รายการหน้า), `smoke.spec.js` (อัตโนมัติจากเมนู)

---

## 9. โมเดลแนะนำสำหรับขั้นลงมือ

**Sonnet 5 medium พอสำหรับส่วนใหญ่** เพราะแบบ/คีย์/สูตร/เทสต์กำหนดไว้ครบแล้ว งานที่เหลือเป็นการย้ายโค้ดที่มีอยู่ตามแบบ

| ขั้น | โมเดล | effort | เหตุผล |
|---|---|---|---|
| 1 `invest-calc.js` + fixture เทียบผลเดิม | Sonnet 5 | high | ต้องถอดตรรกะออกจาก 9 ไฟล์โดยไม่เปลี่ยนตัวเลขสักหลัก + ตารางรหัสเหตุผล |
| 2 `invest-core.js` + news | Sonnet 5 | high | กำหนด API ที่ทุกหน้าใช้ต่อ |
| 3 มูลค่าสินทรัพย์ + snapshot | Sonnet 5 | high | เขียนคีย์ซิงก์จากหน้าวันนี้ + เวลาไทย (ถ้าเทสต์ซิงก์ 2 เครื่องล้มเกิน 2 รอบ → Opus 5.5 high) |
| 4, 5, 7–12 | Sonnet 5 | medium | ย้ายหน้าตามแบบ |
| 6 หน้าหุ้น th/us | Sonnet 5 | high | รวม 2 ไฟล์ใหญ่สุด (1,679 + 1,993 บรรทัด) เป็นโค้ดเดียว parameter ตามตลาด |
| 13 เก็บกวาด | Sonnet 5 | low | แก้เมนู/เอกสาร |
| รีวิวก่อน merge ครั้งสุดท้าย (ครั้งเดียว) | Opus 5.5 | high | ตรวจข้อ 3.1 ทั้งหมด (รูปแบบคีย์/การลบด้วย ts/ไม่มีการย้ายข้อมูล) — ไม่จำเป็นต้องใช้ Fable เพราะไม่มี migration |

ทำต่อใน session เดียวกันได้หลายขั้น (ใช้ไฟล์ชุดเดียวกัน) · เปิด session ใหม่เมื่อเปลี่ยนโมเดล

---

## 10. ข้อห้าม
- ห้ามเปลี่ยนชื่อ/รูปแบบคีย์ในตาราง 1.2 · ห้ามลบคีย์ข้อมูลผู้ใช้ใดๆ (รวม `hub:history`, `portfolio`, `*:tiers`, `*:driveConnected`)
- ห้ามลบด้วยดัชนีแถว · ห้ามถืออาร์เรย์ข้อมูลผู้ใช้ค้างในหน่วยความจำข้ามการเขียน
- ห้ามนับพอร์ตจำลองในมูลค่าสินทรัพย์ · ห้ามใช้อัตราแลกเปลี่ยนที่เดาขึ้นเอง
- ห้ามเพิ่ม public proxy กลับมา · ห้ามสร้าง `ai-chat-worker` จากหน้าลงทุน · ห้ามเรียก `/api/ocr`
- ห้ามฝังเพดาน/ขั้นภาษีใน JS ของหน้ากองทุน (อ่านจาก `tax-rules/*.json` ผ่าน `TaxCalc`)
- ห้ามเพิ่มข้อความอธิบายในหน้า (กฎ CLAUDE.md) — คงไว้ได้แค่ disclaimer บรรทัดเดียวถ้าเจ้าของขอ
- ห้ามลบไฟล์ JS เดิมก่อนหน้าใหม่ที่แทนมัน + stub redirect + PRECACHE อยู่ใน commit เดียวกัน

## 11. สิ่งที่เจ้าของต้องตรวจเองหลัง deploy
1. เปิดบุ๊กมาร์ก/ไอคอนบนหน้าจอโฮมของหน้าลงทุนเดิมที่มี (iPhone) → ต้องไปหน้า/แท็บใหม่
2. ทองไทยดึงได้ผ่าน `/api/proxy` (หลังเพิ่ม `api.chnwt.dev`)
3. ตัวเลขการ์ด "สินทรัพย์ลงทุน" เทียบกับที่รู้จริง (โดยเฉพาะทองรูปพรรณที่ตอนนี้ใช้ราคารับซื้อรูปพรรณ)
4. ใส่ NAV ล่าสุดของกองทุนที่ถือ (ไม่ใส่ = ใช้ต้นทุน)
5. ถ้าใช้ Live Gateway/Twelve Data อยู่ ตรวจว่าตั้งค่าเดิมยังทำงาน
