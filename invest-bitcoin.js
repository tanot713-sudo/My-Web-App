/* ══════════════════════════════════════════════════════════════════
   Tanot — Bitcoin (เทรดสวิงคุมความเสี่ยง + ออม DCA) — ยุบรวมหน้าลงทุน ขั้น 10 (docs/invest-consolidation-design.md)
   • ราคา/ซีรีส์ BTC-USD, อัตราแลกเปลี่ยน, ดัชนีกลัว-โลภ ผ่าน InvestCore (proxy ของเว็บเท่านั้น · แคช cache:btc:BTC-USD / cache:fng / fxcache)
   • ไฟจราจร/คุมเงิน (เศษส่วน เสี่ยงต่อไม้ ≤ 1%)/เช็กลิสต์ (ห้ามเลเวอเรจ)/ควรขาย/DCA: InvestCalc.analyzeSeries · riskCalc.btc · checklist.btc · sellVerdict · simulateDCA
   • พอร์ต tanot:invest:btc {qty, cost, ts, cur?} รูปแบบเดิม · อ่านสด→แก้→เขียน · ลบ/แก้ราคาด้วย ts (ไม่ใช้ดัชนี)
   • ตัดแล้ว: สมุดเทรด (ย้ายไปหน้า invest-trade-journal.html#btc — คีย์ btcjournal ไม่แตะ) · Expectancy · สำรอง Google Drive · AI ในเบราว์เซอร์ (คลาวด์อย่างเดียว task 'stock:bitcoin')
   หมายเหตุ: ตัวช่วยคิด ไม่ใช่คำแนะนำการลงทุน
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var IC = window.InvestCore, Calc = window.InvestCalc;
  var $ = function (id) { return document.getElementById(id); };
  var PF_KEY = 'tanot:invest:btc';
  var lastSeries = null, lastAnalysis = null, lastLive = null;
  var SYM = 'BTC-USD';

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }
  function fmt(n, d) { d = d == null ? 2 : d; return isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'; }
  function fmt0(n) { return isFinite(n) ? Math.round(n).toLocaleString('en-US') : '—'; }
  function usd0(n) { if (!isFinite(n)) return '—'; var neg = n < 0; return (neg ? '−' : '') + '$' + Math.round(Math.abs(n)).toLocaleString('en-US'); }
  function baht(n) { if (!isFinite(n)) return '—'; var neg = n < 0; return (neg ? '−' : '') + '฿' + Math.round(Math.abs(n)).toLocaleString('th-TH'); }
  function esc(s) { return IC.esc(s); }
  function cacheAgeText(ts) { return IC.ago(ts); }

  var L = IC.i18n({
 "th": {
  "navInvest": "การลงทุน",
  "pageTitle": "Bitcoin — ตัวช่วยเข้า/ออก + ออม",
  "step1Title": "ราคา BTC-USD ตอนนี้",
  "lblPriceNow": "ราคาตอนนี้ (USD)",
  "phPriceNow": "เช่น 65000",
  "lblHi": "ราคาสูงสุดของรอบ",
  "lblLo": "ราคาต่ำสุดของรอบ",
  "ph3mo": "ช่วง 3 เดือน",
  "marketModeHist": "โหมดข้อมูล: ย้อนหลัง",
  "marketModeLive": "โหมดข้อมูล: สด / Real-time",
  "marketModeFallback": "โหมดข้อมูล: สำรอง / Historical",
  "marketMetaHistoricalUse": "ใช้ Yahoo สำหรับกราฟย้อนหลัง",
  "marketMetaFallback": "แหล่งข้อมูลสดยังเชื่อมต่อไม่ได้ · ใช้ราคาย้อนหลังเป็น fallback",
  "marketRefreshBtn": "รีเฟรช",
  "marketSettingsBtn": "ตั้งค่าข้อมูลตลาด",
  "marketSettingsTitle": "ข้อมูลตลาดแบบสด",
  "marketProviderLbl": "แหล่งข้อมูล",
  "marketProviderGateway": "Tanot Data Gateway (แนะนำ)",
  "marketProviderTwelve": "Twelve Data",
  "marketProviderYahoo": "Yahoo / ย้อนหลัง",
  "marketGatewayLbl": "Gateway URL",
  "marketApiKeyNote": "(เก็บในเครื่องเท่านั้น)",
  "marketApiKeyPh": "ใส่เมื่อมี API key",
  "marketIntervalLbl": "รีเฟรชทุก",
  "marketInterval5": "5 วินาที",
  "marketInterval10": "10 วินาที",
  "marketInterval30": "30 วินาที",
  "marketSaveBtn": "บันทึกการตั้งค่า",
  "marketClearBtn": "ล้าง API Key",
  "marketSavedMsg": "บันทึกการตั้งค่าแล้ว · ระบบจะดึงข้อมูลตามช่วงเวลาที่ตั้ง",
  "marketApiKeyCleared": "ล้าง API Key จากเครื่องแล้ว",
  "fetchBtn": "ลองดึงราคา",
  "analyzeBtn": "ประเมินให้หน่อย",
  "demoBtn": "ดูกราฟตัวอย่าง (ฝึกอ่าน)",
  "pasteSummary": "วางราคาย้อนหลังเอง (ทางเลือก)",
  "pasteBtn": "ใช้ราคานี้",
  "fxSummary": "แปลงเป็นเงินบาท (ทางเลือก)",
  "fxRateLbl": "อัตราแลกเปลี่ยน",
  "fxRateUnit": "(บาทต่อ 1 USD)",
  "fxRatePh": "เช่น 36.00",
  "fxFetchBtn": "ดึงอัตราปัจจุบัน",
  "fxShowChkLbl": "แสดงยอดเทียบเงินบาท (≈ ฿) ในหน้านี้",
  "fxFetching": "กำลังดึงอัตราแลกเปลี่ยน…",
  "fxFromYahoo": "อัตราจาก Yahoo Finance (THB=X) · เมื่อสักครู่",
  "fxStaleCached": "ดึงสดไม่ได้ — ใช้อัตราที่บันทึกไว้ ({age})",
  "fxFetchFail": "ดึงอัตโนมัติไม่ได้ตอนนี้ — กรอกอัตราแลกเปลี่ยนเองด้านบน",
  "perBtcAtRate": " ต่อ BTC (ตามอัตราที่ตั้งไว้)",
  "lightTitle": "ไฟจราจร",
  "detailsSummary": "ดูรายละเอียดทางเทคนิค ",
  "fngTitle": "ดัชนีความกลัว-ความโลภ (Fear & Greed)",
  "loadingDefault": "กำลังโหลด…",
  "fngExtFear": "กลัวสุดขีด",
  "fngNeutral": "กลาง",
  "fngExtGreed": "โลภสุดขีด",
  "fngLiveSrc": "ข้อมูลสด · Alternative.me",
  "fngStaleSrc": "ดึงสดไม่ได้ — ใช้ค่าที่บันทึกไว้ ({age})",
  "fngFail": "ดึงข้อมูลไม่ได้ตอนนี้",
  "fngRetryLater": "ลองรีเฟรชหน้านี้อีกครั้งภายหลัง",
  "fngClassExtFear": "กลัวสุดขีด",
  "fngClassFear": "กลัว",
  "fngClassNeutral": "เป็นกลาง",
  "fngClassGreed": "โลภ",
  "fngClassExtGreed": "โลภสุดขีด",
  "chartTitle": "กราฟราคา",
  "tf1m": "1เดือน",
  "tf3m": "3เดือน",
  "tf6m": "6เดือน",
  "tf1y": "1ปี",
  "tgMa20": "เฉลี่ย 20",
  "tgMa50": "เฉลี่ย 50",
  "chartCapUp": "แท่งขึ้น",
  "chartCapDown": "แท่งลง",
  "chartCapMa20": "เฉลี่ย 20 วัน",
  "chartCapMa50": "เฉลี่ย 50 วัน",
  "legendOpen": "เปิด",
  "legendHigh": "สูง",
  "legendLow": "ต่ำ",
  "legendClose": "ปิด",
  "step2Title": "ถ้าจะซื้อ ควรใส่เงินเท่าไร ตั้งขายที่ไหน",
  "lblCapital": "เงินลงทุนทั้งพอร์ต (USD)",
  "phCapital": "เช่น 10000",
  "lblRiskPct": "ยอมเสี่ยงต่อไม้",
  "unitPctPortfolio": "(% ของพอร์ต)",
  "phEntry": "= ราคาตอนนี้",
  "lblStop": "ราคาตัดขาดทุน (Stop)",
  "phStop": "แนะนำอัตโนมัติ",
  "lblComm": "ค่าคอมฯ",
  "unitPctPerTrade": "(% ต่อครั้ง)",
  "calcBtn": "คำนวณ",
  "saveToPfBtn": "บันทึกเข้าพอร์ต",
  "savedToPfDone": "บันทึกแล้ว",
  "checklistTitle": "ตรวจก่อนเข้าไม้ — ควรซื้อไหม?",
  "chkNoLeverage": "ยืนยันว่าเทรด spot เท่านั้น ไม่ใช้เลเวอเรจ/มาร์จิ้น",
  "ynYes": "ใช่",
  "ynNo": "ยัง",
  "checkBtn": "ตรวจเช็กลิสต์",
  "pfTitle": "พอร์ต Bitcoin ของฉัน",
  "lblPfQty": "จำนวน BTC",
  "lblPfCost": "ราคาต้นทุน/BTC",
  "pfAddBtn": "เพิ่มเข้าพอร์ต",
  "pfEmptyDefault": "ยังไม่มี BTC ในพอร์ต",
  "pfEmptyAlt": "ยังไม่มี BTC ในพอร์ต — คำนวณด้านบนแล้วกด \"บันทึกเข้าพอร์ต\"",
  "pfColQty": "จำนวน BTC",
  "pfColCost": "ต้นทุน/BTC",
  "pfColCur": "ราคาปัจจุบัน",
  "pfColPl": "กำไร/ขาดทุน",
  "pfPricePh": "ราคา",
  "pfSellBtnTitle": "เช็กควรขาย?",
  "pfSellBtn": "ควรขาย?",
  "pfDelTitle": "ลบ",
  "alertPfInvalid": "กรอกจำนวน BTC และราคาต้นทุนให้ถูกต้อง",
  "dcaTitle": "ออม Bitcoin แบบ DCA (ทางเลือกความเสี่ยงต่ำกว่า)",
  "lblDcaPmt": "ออมเดือนละ",
  "lblDcaStart": "ราคา BTC เริ่มต้น",
  "phDcaStart": "รอราคาจากขั้นที่ 1",
  "lblDcaYears": "วางแผนล่วงหน้า",
  "lblDcaCagr": "สมมติราคาโตเฉลี่ย",
  "dcaCalcBtn": "คำนวณแผน",
  "dcaContribLabel": "เงินที่ลงทั้งหมด",
  "dcaQtyLabel": "BTC สะสม",
  "dcaValueLabel": "มูลค่าประมาณสิ้นแผน",
  "dcaGainLabel": "กำไร/ขาดทุนจากราคาที่เปลี่ยน",
  "dcaCapTotal": "มูลค่ารวม",
  "dcaCapContrib": "เงินที่ใส่ (ต้นทุน)",
  "dcaYrSummary": "ดูตารางรายปี",
  "alertDcaStart": "กรอกราคา BTC เริ่มต้นให้ถูกต้อง (หรือรอราคาจากขั้นที่ 1 โหลดก่อน แล้วลองอีกครั้ง)",
  "alertDcaPmt": "กรอกเงินออมต่อเดือนให้ถูกต้อง",
  "dcaYrCol": "สิ้นปีที่ {n}",
  "dcaYrColContrib": "เงินที่ใส่",
  "dcaYrColQty": "BTC สะสม",
  "dcaYrColVal": "มูลค่า",
  "dcaYrHdYear": "สิ้นปีที่",
  "dcaYrHdContrib": "เงินที่ใส่",
  "dcaYrHdQty": "BTC สะสม",
  "dcaYrHdVal": "มูลค่า",
  "proCheapRange": "ราคาอยู่ช่วงถูกเทียบ 3 เดือน",
  "conExpRange": "ราคาอยู่ช่วงแพงเทียบ 3 เดือน",
  "proRsiLow": "แรงขายเริ่มคลาย (RSI ต่ำ กำลังฟื้น)",
  "conRsiHigh": "ราคาร้อนแรงเกินไป (RSI สูง เสี่ยงย่อ)",
  "proMomUp": "โมเมนตัมเริ่มกลับเป็นบวก",
  "conMomDn": "โมเมนตัมเริ่มอ่อนลง",
  "proUptrend": "ยังอยู่ในแนวโน้มขึ้น",
  "conDowntrend": "อยู่ใต้เส้นแนวโน้ม (ขาลง/พักตัว)",
  "proBbLow": "ราคาแตะกรอบล่าง (มักเป็นจังหวะเด้ง)",
  "conBbHigh": "ราคาชนกรอบบน",
  "verdictGreen": "น่าสนใจ — ลองพิจารณา",
  "verdictRed": "ระวัง — ยังไม่ใช่จังหวะ",
  "verdictYellow": "รอก่อน — ยังไม่มีจังหวะเด่น",
  "whyNeutral": "ราคาอยู่กลางกรอบ ยังไม่มีสัญญาณชัด",
  "simpleGreen": "น่าสนใจ — ลองพิจารณา",
  "simpleRed": "ระวัง — ราคาค่อนข้างแพง",
  "simpleYellow": "รอก่อน — ราคากลางกรอบ",
  "simpleWhyCheap": "ราคาอยู่ค่อนไปทางถูกของรอบ (~{pct}% ของช่วง ต่ำ→สูง)",
  "simpleWhyExp": "ราคาอยู่ค่อนไปทางแพงของรอบ (~{pct}% ของช่วง ต่ำ→สูง)",
  "simpleWhyMid": "ราคาอยู่กลางกรอบ (~{pct}% ของช่วง ต่ำ→สูง)",
  "riskErrStop": "ราคาตัดขาดทุนต้องต่ำกว่าราคาเข้าซื้อ",
  "riskCapLimitedNote": "จำกัดจำนวนตามเงินที่มี (ทุนไม่พอซื้อเท่าที่ความเสี่ยงอนุญาต)",
  "demoSrcBadge": "ข้อมูลตัวอย่าง — ไม่ใช่ราคาจริง (ไว้ฝึกอ่านกราฟ)",
  "pasteSrcBadge": "ราคาที่วางเอง · {n} วัน",
  "realPriceLabel": "ราคาจริง",
  "realSrcBadge": "{src} · {stale} · {n} วัน",
  "staleLastPrice": "ราคาล่าสุด {age}",
  "chartLibFail": "โหลดไลบรารีกราฟไม่ได้ (ลองออนไลน์แล้วรีเฟรช) — ส่วนไฟจราจร/คำนวณเงินยังใช้ได้",
  "detEma20": "เส้นเฉลี่ย 20 วัน (EMA20)",
  "detEma50": "เส้นเฉลี่ย 50 วัน (EMA50)",
  "detRsi": "RSI (14)",
  "detMacdHist": "MACD histogram",
  "detBbUpper": "กรอบบน (Bollinger)",
  "detBbLower": "กรอบล่าง (Bollinger)",
  "detAtr": "ATR (ความผันผวน)",
  "detSupport": "แนวรับล่าสุด",
  "detResistance": "แนวต้านล่าสุด",
  "detAdx": "ความแรงแนวโน้ม (ADX 14)",
  "detPsar": "จุดตัดขาดทุนตาม (Parabolic SAR)",
  "adxStrong": "แข็งแรง",
  "adxWeak": "อ่อน",
  "psarUp": "เทรนด์ขึ้น",
  "psarDown": "เทรนด์ลง",
  "errEnterPriceFirst": "กรอกอย่างน้อย \"ราคาตอนนี้\" ก่อนนะครับ",
  "aiSumTitle": "สรุปราคาบิตคอยน์ด้วย AI",
  "aiSumBtn": "สรุปให้หน่อย",
  "needStockData": "ยังไม่มีข้อมูลราคาให้สรุป — ดึงราคาหรือดูกราฟตัวอย่างก่อนนะครับ",
  "summarizing": "กำลังสรุป…",
  "summarizeFail": "สรุปไม่สำเร็จ ลองอีกครั้ง",
  "summarizeFailWith": "สรุปไม่สำเร็จ: {msg}",
  "summarizeCached": "ผลสรุปนี้คำนวณไว้แล้ว (โหลดจากแคช ไม่ต้องเรียก AI ใหม่)",
  "ctxAsset": "สินทรัพย์: บิตคอยน์ (BTC)",
  "ctxLatestPrice": "ราคาล่าสุด: {v} ดอลลาร์สหรัฐฯ",
  "ctxVerdict": "สัญญาณไฟจราจรที่คำนวณแล้ว: {v} ({why})",
  "ctxPros": "ปัจจัยหนุนที่ตรวจพบ: {v}",
  "ctxCons": "ปัจจัยเสี่ยงที่ตรวจพบ: {v}",
  "ctxRsi": "RSI (14 วัน): {v}",
  "ctxRsiHigh": " (สูง/ร้อนแรง)",
  "ctxRsiLow": " (ต่ำ/แรงขายเริ่มคลาย)",
  "ctxRsiMid": " (กลางๆ)",
  "ctxMacd": "MACD histogram: {v}",
  "ctxMacdPos": " (เป็นบวก)",
  "ctxMacdNeg": " (เป็นลบ)",
  "ctxEma": "เส้นเฉลี่ย 20 วัน: {e20}, เส้นเฉลี่ย 50 วัน: {e50}",
  "ctxEmaUp": " (ราคาอยู่เหนือเส้นเฉลี่ย — แนวโน้มขึ้น)",
  "ctxEmaDn": " (ราคาอยู่ใต้เส้นเฉลี่ย — แนวโน้มลง/พักตัว)",
  "ctxSupport": "แนวรับล่าสุด: {v}",
  "ctxResistance": "แนวต้านล่าสุด: {v}",
  "ctxAdx": "ความแรงแนวโน้ม (ADX): {v}",
  "ctxAdxStrong": " (แข็งแรง)",
  "ctxAdxWeak": " (อ่อน)",
  "grayVerdictNeedRange": "กรอกราคาสูง/ต่ำของรอบ เพื่อประเมินถูก-แพง",
  "grayWhyNeedRange": "หรือกด \"ดูกราฟตัวอย่าง (ฝึกอ่าน)\" เพื่อลองเล่นกราฟ — ตอนนี้ทำได้เฉพาะคำนวณเงินด้านล่าง",
  "fetchingSym": "กำลังดึงข้อมูล {sym}…",
  "updatedAt": "อัปเดต {time}",
  "priceLiveFrom": "ราคาล่าสุด {price} USD · {src} · {time}",
  "priceLiveFromSeries": "ราคา {sym} สดจาก {src} · กราฟย้อนหลัง {n} วัน",
  "staleUseSaved": "แหล่งข้อมูลสดใช้ไม่ได้ · ใช้ข้อมูลย้อนหลังที่บันทึกไว้ ({age}) · {n} วัน",
  "historicalFromSrc": "ขณะนี้ใช้ราคาย้อนหลังจาก {src} · {n} วัน",
  "fetchFail": "ดึงราคาไม่ได้ตอนนี้ — ตรวจการเชื่อมต่อข้อมูลตลาด",
  "demoStatus": "กำลังแสดง \"ข้อมูลตัวอย่าง\" (ไม่ใช่ราคาจริง) — ไว้ลองเล่นกราฟและฝึกอ่าน",
  "pasteErrShort": "วางราคาปิดอย่างน้อย 5 วันก่อนนะครับ",
  "pasteOk": "ใช้ราคาที่วางแล้ว ({n} วัน)",
  "errNeedEntry": "กรอกราคาเข้าซื้อ (หรือราคาตอนนี้) ก่อน",
  "calcQtyLine": "ควรซื้อได้ประมาณ <b>{qty} BTC</b> (≈ {sats} sats) ใช้เงิน ≈ <b>{cost}</b>",
  "kvIfWrong": "ถ้าผิดทาง (แตะ Stop) เสียไม่เกิน",
  "kvStop": "ราคาตัดขาดทุน (Stop)",
  "kvBreakeven": "ราคาคุ้มทุน (รวมค่าคอมฯ ไป-กลับ)",
  "kvRr": "ความคุ้ม (กำไรคาดหวัง : ความเสี่ยง) ถึงแนวต้าน",
  "tpChip1": "ทยอยขายไม้ 1 (TP1): {v}",
  "tpChip2": "ไม้ 2 (TP2): {v}",
  "tpChip3": "ไม้ 3 (TP3, ที่เหลือ trail stop): {v}",
  "pfSellFetching": "กำลังดึงราคา {sym}…",
  "sellDetailPrice": "ราคาล่าสุด {price}{stale} · ต้นทุน {cost} · {plWord}{pl} ({sign}{pct}%)",
  "staleSaved": " (บันทึกไว้ {age})",
  "profitWord": "กำไร ",
  "lossWord": "ขาดทุน ",
  "sellFetchFail": "ดึงราคา {sym} ไม่ได้ตอนนี้ — ลองใหม่อีกครั้ง หรือกรอกราคาปัจจุบันเองในช่อง",
  "sellVerdictSar": "พิจารณาขาย — สัญญาณเทรนด์กลับตัว (SAR พลิกลง)",
  "sellVerdictTrend": "พิจารณาขาย/ตัดขาดทุน — ราคาหลุดแนวโน้ม (ต่ำกว่าเส้นค่าเฉลี่ย)",
  "sellVerdictRsi": "พิจารณาล็อกกำไรบางส่วน — RSI สูง ราคาร้อนแรง อาจย่อ",
  "sellVerdictResist": "ใกล้แนวต้าน — พิจารณาล็อกกำไรบางส่วน",
  "sellVerdictGo": "ยังอยู่ในแนวโน้มขึ้น — ถือต่อได้ เลื่อนจุดตัดขาดทุนตามแนวด้านล่าง",
  "lvSarLabel": "แนวตัดขาดทุนตามเทรนด์ (SAR)",
  "lvSarReasonNoData": "ข้อมูลไม่พอคำนวณ (ต้องมีประวัติราคาอย่างน้อย ~3 วัน)",
  "lvSarReasonUp": "ถ้าราคาปิดหลุดต่ำกว่า {v} ถือว่าเทรนด์ขาขึ้นเริ่มกลับตัว",
  "lvSarReasonDown": "ราคาหลุดแนวนี้ไปแล้ว (SAR พลิกลง) — เป็นสัญญาณเตือนที่ชัดที่สุด",
  "lvStopLabel": "จุดตัดขาดทุนตามความเสี่ยง (ATR/แนวรับ)",
  "lvStopReasonNoData": "ข้อมูลไม่พอคำนวณ",
  "lvStopReason": "กันขาดทุนหนักถ้าราคาหลุดแนวรับหรือผันผวนเกินค่าเฉลี่ย",
  "lvStopAtrSuffix": " (ATR ≈ {v})",
  "lvEma20Label": "เส้นค่าเฉลี่ย 20 วัน (สัญญาณเตือนแรก)",
  "lvEma20ReasonNoData": "ข้อมูลไม่พอคำนวณ",
  "lvEma20Reason": "หลุดเส้นนี้มักเป็นสัญญาณเริ่มอ่อนตัว — ยังไม่ใช่จุดตัดขาดทุนหลัก แต่ควรเริ่มระวัง",
  "lvResistLabel": "แนวต้าน (จุดพิจารณาล็อกกำไรบางส่วน)",
  "lvResistReasonNoData": "ข้อมูลไม่พอคำนวณ",
  "lvResistReason": "ราคามักเจอแรงขายทำกำไรบริเวณนี้ พิจารณาขายบางส่วนหรือเลื่อนจุดตัดขาดทุนตามเพื่อป้องกันกำไร",
  "chkTrendUp": "อยู่ในแนวโน้มขึ้น (ราคาเหนือเส้นเฉลี่ย)",
  "chkTrendDn": "ยังไม่อยู่ในแนวโน้มขึ้น (ราคาใต้เส้นเฉลี่ย)",
  "chkAdxSuffix": " · ADX {v} {label}",
  "chkAdxStrong": "เทรนด์แข็งแรง",
  "chkAdxWeak": "เทรนด์อ่อน ควรระวัง",
  "chkNoChase": "ไม่ไล่ราคา (ห่างเส้นเฉลี่ย 20 ไม่เกิน 5%)",
  "chkChasing": "กำลังไล่ราคา (สูงกว่าเส้นเฉลี่ย 20 เกิน 5%)",
  "chkTrendNeedData": "แนวโน้ม/การไล่ราคา: ต้องมีข้อมูลกราฟก่อน (กด \"ดึงราคา\" หรือ \"ดูกราฟตัวอย่าง\")",
  "chkRsiOk": "ไม่ร้อนแรงเกิน (RSI {v})",
  "chkRsiHot": "ร้อนแรงเกินไป (RSI {v} ≥ 70) เสี่ยงย่อ",
  "chkRsiNeedData": "RSI: ต้องมีข้อมูลกราฟก่อน",
  "chkStopSet": "ตั้งจุดตัดขาดทุน (Stop) แล้ว",
  "chkStopUnset": "ยังไม่ตั้งจุดตัดขาดทุน — กด \"คำนวณ\" ในขั้นที่ 2 ก่อน",
  "chkRiskOk": "เสี่ยงต่อไม้ ≤ 1% ({v}%) — เหมาะกับความผันผวนของคริปโต",
  "chkRiskHigh": "เสี่ยงต่อไม้สูงไปสำหรับคริปโต ({v}) — คริปโตผันผวนกว่าหุ้นทั่วไป ~3-4 เท่า ควร ≤ 1%",
  "chkRrOk": "กำไรคาดหวัง:เสี่ยง ≥ 2:1 ({v}:1)",
  "chkRrLow": "กำไร:เสี่ยงน้อยไป ({v}:1) — ควร ≥ 2:1",
  "chkRrNeedData": "กำไร:เสี่ยง: ต้องมีแนวต้านจากกราฟ + ตั้ง Stop ก่อน",
  "chkLeverageYes": "ไม่ใช้เลเวอเรจ/มาร์จิ้น (เทรด spot เท่านั้น) ยืนยันแล้ว",
  "chkLeverageNo": "กำลังใช้เลเวอเรจ/มาร์จิ้น — เสี่ยงถูกบังคับปิดสถานะ (liquidation) จากความผันผวนระยะสั้น แนะนำเทรด spot เท่านั้น",
  "chkLeverageUnknown": "ยืนยันก่อนว่าเทรด spot ไม่ใช้เลเวอเรจ/มาร์จิ้น (กดปุ่มด้านบน)",
  "checklistFail": "ยังไม่ควรเข้า — ติด {n} ข้อ ควรแก้ให้ครบก่อนซื้อ",
  "checklistUnknown": "ข้อมูลไม่พอประเมินครบ — กด \"ประเมิน\"/\"ดึงราคา\" แล้ว \"คำนวณ\" และตอบคำถามด้านบนก่อน",
  "checklistGo": "เข้าได้ตามแผน — ผ่านครบทุกข้อ (แต่ยังไม่การันตีกำไร ทำตามแผนและตัดขาดทุนเสมอ)",
  "journalLinkBtn": "สมุดเทรด"
 },
 "en": {
  "navInvest": "Investing",
  "pageTitle": "Bitcoin — Entry/Exit Helper + Savings",
  "step1Title": "Current BTC-USD price",
  "lblPriceNow": "Current price (USD)",
  "phPriceNow": "e.g. 65000",
  "lblHi": "Cycle high price",
  "lblLo": "Cycle low price",
  "ph3mo": "3-month range",
  "marketModeHist": "Data mode: Historical",
  "marketModeLive": "Data mode: Live / Real-time",
  "marketModeFallback": "Data mode: Fallback / Historical",
  "marketMetaHistoricalUse": "Using Yahoo for historical charts",
  "marketMetaFallback": "Live data source isn't reachable · using historical price as fallback",
  "marketRefreshBtn": "Refresh",
  "marketSettingsBtn": "Market data settings",
  "marketSettingsTitle": "Live market data",
  "marketProviderLbl": "Data source",
  "marketProviderGateway": "Tanot Data Gateway (recommended)",
  "marketProviderTwelve": "Twelve Data",
  "marketProviderYahoo": "Yahoo / Historical",
  "marketGatewayLbl": "Gateway URL",
  "marketApiKeyNote": "(stored locally only)",
  "marketApiKeyPh": "Enter if you have an API key",
  "marketIntervalLbl": "Refresh every",
  "marketInterval5": "5 seconds",
  "marketInterval10": "10 seconds",
  "marketInterval30": "30 seconds",
  "marketSaveBtn": "Save settings",
  "marketClearBtn": "Clear API key",
  "marketSavedMsg": "Settings saved · data will refresh at the set interval",
  "marketApiKeyCleared": "API key cleared from this device",
  "updatedAt": "updated {time}",
  "fetchBtn": "Try fetching price",
  "analyzeBtn": "Assess it for me",
  "demoBtn": "View sample chart (practice)",
  "pasteSummary": "Paste historical prices yourself (optional)",
  "pasteBtn": "Use this price",
  "fxSummary": "Convert to Thai baht (optional)",
  "fxRateLbl": "Exchange rate",
  "fxRateUnit": "(THB per 1 USD)",
  "fxRatePh": "e.g. 36.00",
  "fxFetchBtn": "Fetch current rate",
  "fxShowChkLbl": "Show amounts converted to baht (≈ ฿) on this page",
  "fxFetching": "Fetching exchange rate…",
  "fxFromYahoo": "Rate from Yahoo Finance (THB=X) · just now",
  "fxStaleCached": "Live fetch failed — using the saved rate ({age})",
  "fxFetchFail": "Couldn't auto-fetch right now — enter the exchange rate yourself above",
  "perBtcAtRate": " per BTC (at the rate you set)",
  "lightTitle": "Traffic Light",
  "detailsSummary": "Technical details",
  "fngTitle": "Fear & Greed Index",
  "loadingDefault": "Loading…",
  "fngExtFear": "Extreme Fear",
  "fngNeutral": "Neutral",
  "fngExtGreed": "Extreme Greed",
  "fngLiveSrc": "Live data · Alternative.me",
  "fngStaleSrc": "Live fetch failed — using saved value ({age})",
  "fngFail": "Couldn't fetch data right now",
  "fngRetryLater": "Try refreshing this page again later",
  "fngClassExtFear": "Extreme Fear",
  "fngClassFear": "Fear",
  "fngClassNeutral": "Neutral",
  "fngClassGreed": "Greed",
  "fngClassExtGreed": "Extreme Greed",
  "chartTitle": "Price Chart",
  "tf1m": "1M",
  "tf3m": "3M",
  "tf6m": "6M",
  "tf1y": "1Y",
  "tgMa20": "MA 20",
  "tgMa50": "MA 50",
  "chartCapUp": "Up candle",
  "chartCapDown": "Down candle",
  "chartCapMa20": "20-day average",
  "chartCapMa50": "50-day average",
  "legendOpen": "Open",
  "legendHigh": "High",
  "legendLow": "Low",
  "legendClose": "Close",
  "step2Title": "If you buy, how much should you put in, and where should you sell",
  "lblCapital": "Total capital (USD)",
  "phCapital": "e.g. 10000",
  "lblRiskPct": "Risk tolerance per trade",
  "unitPctPortfolio": "(% of portfolio)",
  "phEntry": "= current price",
  "lblStop": "Stop-loss price",
  "phStop": "Auto-suggested",
  "lblComm": "Commission",
  "unitPctPerTrade": "(% per trade)",
  "calcBtn": "Calculate",
  "saveToPfBtn": "Save to portfolio",
  "savedToPfDone": "Saved",
  "checklistTitle": "Pre-trade check — should you buy?",
  "chkNoLeverage": "Confirm you only trade spot, no leverage/margin",
  "ynYes": "Yes",
  "ynNo": "Not yet",
  "checkBtn": "Check the checklist",
  "pfTitle": "My Bitcoin Portfolio",
  "lblPfQty": "BTC amount",
  "lblPfCost": "Cost per BTC",
  "pfAddBtn": "Add to portfolio",
  "pfEmptyDefault": "No BTC in your portfolio yet",
  "pfEmptyAlt": "No BTC in your portfolio yet — calculate above then press \"Save to portfolio\"",
  "pfColQty": "BTC amount",
  "pfColCost": "Cost/BTC",
  "pfColCur": "Current price",
  "pfColPl": "Profit/Loss",
  "pfPricePh": "Price",
  "pfSellBtnTitle": "Check should I sell?",
  "pfSellBtn": "Should I sell?",
  "pfDelTitle": "Delete",
  "alertPfInvalid": "Enter a valid BTC amount and cost price",
  "dcaTitle": "Bitcoin DCA Savings Plan (a lower-risk alternative)",
  "lblDcaPmt": "Monthly savings",
  "lblDcaStart": "Starting BTC price",
  "phDcaStart": "Waiting for price from step 1",
  "lblDcaYears": "Plan ahead",
  "lblDcaCagr": "Assumed average growth",
  "dcaCalcBtn": "Calculate plan",
  "dcaContribLabel": "Total contributed",
  "dcaQtyLabel": "BTC accumulated",
  "dcaValueLabel": "Estimated value at plan end",
  "dcaGainLabel": "Gain/loss from price change",
  "dcaCapTotal": "Total value",
  "dcaCapContrib": "Amount contributed (cost)",
  "dcaYrSummary": "View year-by-year table",
  "alertDcaStart": "Enter a valid starting BTC price (or wait for the price from step 1 to load, then try again)",
  "alertDcaPmt": "Enter a valid monthly savings amount",
  "dcaYrCol": "End of year {n}",
  "dcaYrColContrib": "Contributed",
  "dcaYrColQty": "BTC accumulated",
  "dcaYrColVal": "Value",
  "dcaYrHdYear": "End of year",
  "dcaYrHdContrib": "Contributed",
  "dcaYrHdQty": "BTC accumulated",
  "dcaYrHdVal": "Value",
  "proCheapRange": "Price is in the cheap zone vs. the last 3 months",
  "conExpRange": "Price is in the expensive zone vs. the last 3 months",
  "proRsiLow": "Selling pressure easing (RSI low, recovering)",
  "conRsiHigh": "Price is overheated (RSI high, risk of a pullback)",
  "proMomUp": "Momentum is turning positive",
  "conMomDn": "Momentum is weakening",
  "proUptrend": "Still in an uptrend",
  "conDowntrend": "Below the trend line (downtrend/consolidation)",
  "proBbLow": "Price is touching the lower band (often a bounce zone)",
  "conBbHigh": "Price is hitting the upper band",
  "verdictGreen": "Interesting — worth considering",
  "verdictRed": "Careful — not the right moment yet",
  "verdictYellow": "Wait — no standout opportunity yet",
  "whyNeutral": "Price is in the middle of the range, no clear signal yet",
  "simpleGreen": "Interesting — worth considering",
  "simpleRed": "Careful — price is fairly expensive",
  "simpleYellow": "Wait — price is in the middle of the range",
  "simpleWhyCheap": "Price is toward the cheap end of the range (~{pct}% of the low→high span)",
  "simpleWhyExp": "Price is toward the expensive end of the range (~{pct}% of the low→high span)",
  "simpleWhyMid": "Price is in the middle of the range (~{pct}% of the low→high span)",
  "riskErrStop": "The stop-loss price must be below the entry price",
  "riskCapLimitedNote": "Limited by available funds (capital is not enough to buy the full amount the risk setting would allow)",
  "demoSrcBadge": "Sample data — not a real price (for chart-reading practice)",
  "pasteSrcBadge": "Manually pasted price · {n} days",
  "realPriceLabel": "Real price",
  "realSrcBadge": "{src} · {stale} · {n} days",
  "staleLastPrice": "Latest price {age}",
  "chartLibFail": "Couldn't load the chart library (try again online and refresh) — the traffic light/money calculator still work",
  "detEma20": "20-day average (EMA20)",
  "detEma50": "50-day average (EMA50)",
  "detRsi": "RSI (14)",
  "detMacdHist": "MACD histogram",
  "detBbUpper": "Upper band (Bollinger)",
  "detBbLower": "Lower band (Bollinger)",
  "detAtr": "ATR (volatility)",
  "detSupport": "Latest support",
  "detResistance": "Latest resistance",
  "detAdx": "Trend strength (ADX 14)",
  "detPsar": "Trailing stop (Parabolic SAR)",
  "adxStrong": "strong",
  "adxWeak": "weak",
  "psarUp": "uptrend",
  "psarDown": "downtrend",
  "errEnterPriceFirst": "Please enter at least the \"current price\" first",
  "aiSumTitle": "AI Bitcoin Price Summary",
  "aiSumBtn": "Summarize It",
  "needStockData": "No price data to summarize yet — fetch a price or view the sample chart first",
  "summarizing": "Summarizing…",
  "summarizeFail": "Summary failed, try again",
  "summarizeFailWith": "Summary failed: {msg}",
  "summarizeCached": "Already summarized (loaded from cache — no new AI call needed)",
  "ctxAsset": "Asset: Bitcoin (BTC)",
  "ctxLatestPrice": "Latest price: {v} USD",
  "ctxVerdict": "Computed signal: {v} ({why})",
  "ctxPros": "Detected tailwinds: {v}",
  "ctxCons": "Detected risks: {v}",
  "ctxRsi": "RSI (14-day): {v}",
  "ctxRsiHigh": " (high/overheated)",
  "ctxRsiLow": " (low/selling pressure easing)",
  "ctxRsiMid": " (neutral)",
  "ctxMacd": "MACD histogram: {v}",
  "ctxMacdPos": " (positive)",
  "ctxMacdNeg": " (negative)",
  "ctxEma": "20-day MA: {e20}, 50-day MA: {e50}",
  "ctxEmaUp": " (price above the MAs — uptrend)",
  "ctxEmaDn": " (price below the MAs — downtrend/consolidation)",
  "ctxSupport": "Latest support: {v}",
  "ctxResistance": "Latest resistance: {v}",
  "ctxAdx": "Trend strength (ADX): {v}",
  "ctxAdxStrong": " (strong)",
  "ctxAdxWeak": " (weak)",
  "grayVerdictNeedRange": "Enter the cycle high/low price to assess cheap vs. expensive",
  "grayWhyNeedRange": "Or press \"View sample chart (practice)\" to try the chart — for now only the money calculator below works",
  "fetchingSym": "Fetching {sym} data…",
  "priceLiveFrom": "Latest price {price} USD · {src} · {time}",
  "priceLiveFromSeries": "Live {sym} price from {src} · {n}-day historical chart",
  "staleUseSaved": "Live data source unavailable · using saved historical data ({age}) · {n} days",
  "historicalFromSrc": "Currently using historical price from {src} · {n} days",
  "fetchFail": "Couldn't fetch the price right now — check your market data connection",
  "demoStatus": "Showing \"sample data\" (not a real price) — for practicing chart reading",
  "pasteErrShort": "Paste at least 5 days of closing prices first",
  "pasteOk": "Using the pasted price ({n} days)",
  "errNeedEntry": "Enter the entry price (or current price) first",
  "calcQtyLine": "You could buy about <b>{qty} BTC</b> (≈ {sats} sats) using ≈ <b>{cost}</b>",
  "kvIfWrong": "If wrong (hits Stop), you lose no more than",
  "kvStop": "Stop-loss price (Stop)",
  "kvBreakeven": "Break-even price (including round-trip commission)",
  "kvRr": "Reward:risk to resistance",
  "tpChip1": "Sell portion 1 (TP1): {v}",
  "tpChip2": "Portion 2 (TP2): {v}",
  "tpChip3": "Portion 3 (TP3, trail the rest): {v}",
  "pfSellFetching": "Fetching {sym} price…",
  "sellDetailPrice": "Latest price {price}{stale} · cost {cost} · {plWord}{pl} ({sign}{pct}%)",
  "staleSaved": " (saved {age})",
  "profitWord": "profit of ",
  "lossWord": "loss of ",
  "sellFetchFail": "Couldn't fetch the {sym} price right now — try again, or enter the current price yourself in the field",
  "sellVerdictSar": "Consider selling — trend reversal signal (SAR flipped down)",
  "sellVerdictTrend": "Consider selling/cutting losses — price has broken the trend (below the moving average)",
  "sellVerdictRsi": "Consider locking in some profit — RSI is high, price is overheated, may pull back",
  "sellVerdictResist": "Near resistance — consider locking in some profit",
  "sellVerdictGo": "Still in an uptrend — you can keep holding, trail your stop along the line below",
  "lvSarLabel": "Trend-following stop (SAR)",
  "lvSarReasonNoData": "Not enough data to calculate (needs at least ~3 days of price history)",
  "lvSarReasonUp": "If the closing price breaks below {v}, the uptrend is considered to be reversing",
  "lvSarReasonDown": "Price has already broken this level (SAR flipped down) — the clearest warning signal",
  "lvStopLabel": "Risk-based stop-loss (ATR/support)",
  "lvStopReasonNoData": "Not enough data to calculate",
  "lvStopReason": "Protects against a heavy loss if the price breaks support or swings beyond the average",
  "lvStopAtrSuffix": " (ATR ≈ {v})",
  "lvEma20Label": "20-day moving average (early warning signal)",
  "lvEma20ReasonNoData": "Not enough data to calculate",
  "lvEma20Reason": "Breaking below this line is often an early sign of weakening — not the main stop-loss, but worth watching",
  "lvResistLabel": "Resistance (a point to consider locking in some profit)",
  "lvResistReasonNoData": "Not enough data to calculate",
  "lvResistReason": "Price often meets profit-taking pressure around here — consider selling a portion or trailing your stop to protect gains",
  "chkTrendUp": "In an uptrend (price above the moving average)",
  "chkTrendDn": "Not yet in an uptrend (price below the moving average)",
  "chkAdxSuffix": " · ADX {v} {label}",
  "chkAdxStrong": "strong trend",
  "chkAdxWeak": "weak trend, be careful",
  "chkNoChase": "Not chasing the price (within 5% of the 20-day average)",
  "chkChasing": "Chasing the price (more than 5% above the 20-day average)",
  "chkTrendNeedData": "Trend/price-chasing: needs chart data first (press \"Fetch price\" or \"View sample chart\")",
  "chkRsiOk": "Not overheated (RSI {v})",
  "chkRsiHot": "Overheated (RSI {v} ≥ 70), risk of a pullback",
  "chkRsiNeedData": "RSI: needs chart data first",
  "chkStopSet": "Stop-loss (Stop) is set",
  "chkStopUnset": "Stop-loss not set yet — press \"Calculate\" in step 2 first",
  "chkRiskOk": "Risk per trade ≤ 1% ({v}%) — suits crypto volatility",
  "chkRiskHigh": "Risk per trade is too high for crypto ({v}) — crypto is ~3-4x more volatile than typical stocks, should be ≤ 1%",
  "chkRrOk": "Reward:risk ≥ 2:1 ({v}:1)",
  "chkRrLow": "Reward:risk too low ({v}:1) — should be ≥ 2:1",
  "chkRrNeedData": "Reward:risk: needs resistance from the chart + a Stop set first",
  "chkLeverageYes": "Confirmed: no leverage/margin (spot trading only)",
  "chkLeverageNo": "Currently using leverage/margin — risk of forced liquidation from short-term volatility; spot trading only is recommended",
  "chkLeverageUnknown": "Confirm first that you trade spot with no leverage/margin (press the button above)",
  "checklistFail": "Not ready to enter yet — {n} item(s) failed; fix them all before buying",
  "checklistUnknown": "Not enough information to fully assess — press \"Assess\"/\"Fetch price\" then \"Calculate\", and answer the questions above first",
  "checklistGo": "Ready to enter per plan — passed every item (still no profit guarantee — follow the plan and always cut losses)",
  "journalLinkBtn": "Trade journal"
 }
});
  var t = L.t;
  function applyStaticI18n() { L.apply(); }

  /* ── รหัสจาก InvestCalc → ข้อความ ── */
  var WHY_KEY = { cheapRange: 'proCheapRange', expensiveRange: 'conExpRange', rsiLow: 'proRsiLow', rsiHigh: 'conRsiHigh', momUp: 'proMomUp', momDn: 'conMomDn',
    uptrend: 'proUptrend', downtrend: 'conDowntrend', bbLow: 'proBbLow', bbHigh: 'conBbHigh', neutral: 'whyNeutral' };
  function whyText(code, a) {
    if (code === 'cheapPct') return t('simpleWhyCheap', { pct: a.pct });
    if (code === 'expensivePct') return t('simpleWhyExp', { pct: a.pct });
    if (code === 'midPct') return t('simpleWhyMid', { pct: a.pct });
    return t(WHY_KEY[code] || 'whyNeutral');
  }
  function verdictText(a) {
    if (a.simple) return t(a.light === 'green' ? 'simpleGreen' : a.light === 'red' ? 'simpleRed' : 'simpleYellow');
    return t(a.light === 'green' ? 'verdictGreen' : a.light === 'red' ? 'verdictRed' : 'verdictYellow');
  }
  function decorate(a) {
    a.verdict = verdictText(a);
    a.whyCode = a.why;
    a.why = whyText(a.why, a);
    a.prosT = (a.pros || []).map(function (c) { return whyText(c, a); });
    a.consT = (a.cons || []).map(function (c) { return whyText(c, a); });
    return a;
  }
  function analyze(s) { return decorate(Calc.analyzeSeries(s)); }

  /* ══════ อัตราแลกเปลี่ยน USD→บาท (ทางเลือก) ══════ */
  var fxRate = NaN;
  function setFxStatus(msg, cls) { var el = $('fxStatus'); if (el) { el.textContent = msg; el.className = 'status' + (cls ? ' ' + cls : ''); } }
  function fxOn() { return !!($('fxShowChk') && $('fxShowChk').checked) && isFinite(fxRate) && fxRate > 0; }
  function fxSpan(n) { return (fxOn() && isFinite(n)) ? (' <span class="fx-sub">(≈ ' + baht(n * fxRate) + ')</span>') : ''; }
  function updatePriceFx() {
    var el = $('priceFx'); if (!el) return;
    var p = num($('price').value);
    el.textContent = (fxOn() && isFinite(p)) ? ('≈ ' + baht(p * fxRate) + t('perBtcAtRate')) : '';
  }
  function doFxFetch() {
    setFxStatus(t('fxFetching'));
    IC.fx('USD', { force: true }).then(function (r) {
      fxRate = r.rate; $('fxRate').value = r.rate.toFixed(2);
      setFxStatus(r.stale ? t('fxStaleCached', { age: cacheAgeText(r.ts) }) : t('fxFromYahoo'), 'ok');
      updatePriceFx(); if ($('riskResult').classList.contains('show')) doCalc(); renderPf();
    }, function () { setFxStatus(t('fxFetchFail'), 'err'); });
  }

  /* ══════ ดัชนีความกลัว-ความโลภ (InvestCore.fng) ══════ */
  var FNG_CLASS_KEY = { 'Extreme Fear': 'fngClassExtFear', 'Fear': 'fngClassFear', 'Neutral': 'fngClassNeutral', 'Greed': 'fngClassGreed', 'Extreme Greed': 'fngClassExtGreed' };
  function fngClassLabel(c) { var k = FNG_CLASS_KEY[c]; return k ? t(k) : c; }
  function renderFngValue(value, classification, badgeCls, badgeText) {
    $('fngNum').textContent = value;
    $('fngLabel').textContent = fngClassLabel(classification) + ' (' + value + '/100)';
    $('fngMarker').style.left = Math.max(0, Math.min(100, value)) + '%';
    var badge = $('fngBadge'); badge.style.display = 'inline-block'; badge.className = 'badge wrap' + (badgeCls === 'real' ? ' ok' : ''); badge.textContent = badgeText;
  }
  var lastFng = null;
  function runFng() {
    IC.fng().then(function (r) {
      lastFng = r;
      renderFngValue(r.value, r.classification, 'real', r.stale ? t('fngStaleSrc', { age: cacheAgeText(r.ts) }) : t('fngLiveSrc'));
    }, function () {
      lastFng = null;
      $('fngLabel').textContent = t('fngFail');
      var badge = $('fngBadge'); badge.style.display = 'inline-block'; badge.className = 'badge wrap'; badge.textContent = t('fngRetryLater');
    });
  }

  /* ══════ กราฟ lightweight-charts ══════ */
  var LWC = null, chart = null, candle = null, volS = null, ma20S = null, ma50S = null, rsiChart = null, rsiS = null;
  var fullData = null, curTF = 63, tg = { ma20: true, ma50: true, vol: true, rsi: false }, syncing = false, themeObs = null;

  /* สีกราฟทั้งหมดมาจาก chart-theme.js (โทเคน --ome-chart-*): แท่งขึ้น/ลง = up/down, เฉลี่ย 20 = สี 4, เฉลี่ย 50 = สี 1, RSI = สี 7 */
  var CT = window.OmeChartTheme;
  function serie() { var c = CT.get(); return { up: c.up, down: c.down, ma20: c.series[3], ma50: c.series[0], rsi: c.series[6] }; }
  function volColored(arr) {
    var c = CT.get(), u = CT.alpha(c.up, 0.5), d = CT.alpha(c.down, 0.5);
    return arr.map(function (b) { return { time: b.time, value: b.value, color: b.up ? u : d }; });
  }
  function chartWidth(el) { return Math.max(240, (el && (el.clientWidth || el.offsetWidth)) || (el && el.parentElement && el.parentElement.clientWidth) || 320); }
  function baseOpts(w, h) {
    var o = CT.lightweight();
    o.width = w; o.height = h;
    o.localization = { locale: 'en-US' };
    o.timeScale.rightOffset = 3; o.timeScale.fixLeftEdge = true;
    o.crosshair.mode = (LWC && LWC.CrosshairMode) ? LWC.CrosshairMode.Normal : 1;
    o.handleScroll = true; o.handleScale = true;
    return o;
  }
  function fmtDate(t) {
    if (typeof t === 'string') { var p = t.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
    if (t && t.year) return t.day + '/' + t.month + '/' + t.year; return String(t);
  }
  function showLegend(time, o) {
    var up = o.close >= o.open;
    $('lwLegend').innerHTML = '<span>' + fmtDate(time) + '</span>' +
      '<span>' + t('legendOpen') + ' ' + fmt(o.open) + '</span><span>' + t('legendHigh') + ' ' + fmt(o.high) + '</span><span>' + t('legendLow') + ' ' + fmt(o.low) + '</span>' +
      '<span class="' + (up ? 'up' : 'dn') + '">' + t('legendClose') + ' ' + fmt(o.close) + '</span>';
  }
  function updateLegendLast() { if (!fullData) return; var o = fullData.ohlc[fullData.ohlc.length - 1]; showLegend(o.time, o); }
  function onCross(param) {
    if (!param || !param.time || !param.seriesData) { updateLegendLast(); return; }
    var o = param.seriesData.get(candle);
    if (o) showLegend(param.time, o); else updateLegendLast();
  }
  function linkTime(a, b) {
    a.timeScale().subscribeVisibleLogicalRangeChange(function (r) {
      if (syncing || !r) return; syncing = true; try { b.timeScale().setVisibleLogicalRange(r); } catch (e) {} syncing = false;
    });
  }
  function cutoffTime() { return fullData.times[Math.max(0, fullData.times.length - curTF)]; }

  function buildRsi() {
    if (rsiChart || !fullData || !LWC) return;
    var el = $('lwRsi'); el.innerHTML = '';
    rsiChart = LWC.createChart(el, baseOpts(chartWidth(el), 110));
    var sc = serie();
    rsiS = rsiChart.addLineSeries({ color: sc.rsi, lineWidth: 2, priceLineVisible: false });
    try {
      rsiS.createPriceLine({ price: 70, color: sc.down, lineStyle: 2, lineWidth: 1, axisLabelVisible: true, title: '70' });
      rsiS.createPriceLine({ price: 30, color: sc.up, lineStyle: 2, lineWidth: 1, axisLabelVisible: true, title: '30' });
    } catch (e) {}
    var cut = cutoffTime();
    rsiS.setData(fullData.rsi.filter(function (p) { return p.time >= cut; }));
    rsiChart.timeScale().fitContent();
    linkTime(chart, rsiChart); linkTime(rsiChart, chart);
  }
  function applyToggles() {
    if (ma20S) ma20S.applyOptions({ visible: tg.ma20 });
    if (ma50S) ma50S.applyOptions({ visible: tg.ma50 });
    if (volS) volS.applyOptions({ visible: tg.vol });
    if (tg.rsi) { buildRsi(); $('lwRsi').style.display = 'block'; }
    else { $('lwRsi').style.display = 'none'; if (rsiChart) { try { rsiChart.remove(); } catch (e) {} rsiChart = null; rsiS = null; } }
    [].forEach.call(document.querySelectorAll('#tgGroup .tg'), function (b) { b.classList.toggle('on', !!tg[b.getAttribute('data-tg')]); });
  }
  function applyTF(n) {
    curTF = n; if (!fullData || !candle) return;
    var s = Math.max(0, fullData.ohlc.length - n), cut = fullData.times[s];
    candle.setData(fullData.ohlc.slice(s));
    volS.setData(volColored(fullData.vol.slice(s)));
    ma20S.setData(fullData.ma20.filter(function (p) { return p.time >= cut; }));
    ma50S.setData(fullData.ma50.filter(function (p) { return p.time >= cut; }));
    if (rsiChart && rsiS) rsiS.setData(fullData.rsi.filter(function (p) { return p.time >= cut; }));
    chart.timeScale().fitContent();
    if (rsiChart) rsiChart.timeScale().fitContent();
    updateLegendLast();
    [].forEach.call(document.querySelectorAll('#tfGroup .tf'), function (b) { b.classList.toggle('on', +b.getAttribute('data-tf') === n); });
  }
  function recolor() {
    if (!chart) return;
    var sc = serie(), base = CT.lightweight();
    chart.applyOptions(base);
    candle.applyOptions(CT.candles());
    ma20S.applyOptions({ color: sc.ma20 }); ma50S.applyOptions({ color: sc.ma50 });
    var s = Math.max(0, fullData.ohlc.length - curTF);
    volS.setData(volColored(fullData.vol.slice(s)));
    if (rsiChart) { try { rsiChart.remove(); } catch (e) {} rsiChart = null; rsiS = null; buildRsi(); }
  }
  function setupThemeObserver() {
    if (themeObs) return;
    themeObs = true; CT.onChange(recolor);
  }
  function buildChart(data) {
    if (!window.LightweightCharts) { return false; }
    LWC = window.LightweightCharts; fullData = data;
    if (chart) { try { chart.remove(); } catch (e) {} chart = null; }
    if (rsiChart) { try { rsiChart.remove(); } catch (e) {} rsiChart = null; rsiS = null; }
    $('chartCard').style.display = 'block';
    var el = $('lwChart'); el.innerHTML = '';
    chart = LWC.createChart(el, baseOpts(chartWidth(el), 300));
    var sc = serie();
    candle = chart.addCandlestickSeries(Object.assign({ borderVisible: false }, CT.candles()));
    volS = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'vol' });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    ma20S = chart.addLineSeries({ color: sc.ma20, lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    ma50S = chart.addLineSeries({ color: sc.ma50, lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    chart.subscribeCrosshairMove(onCross);
    applyTF(curTF); applyToggles(); setupThemeObserver(); setupResize();
    if (window.requestAnimationFrame) requestAnimationFrame(reflow);
    setTimeout(reflow, 120);
    return true;
  }
  function reflow() {
    var el = $('lwChart');
    if (chart && el) { try { chart.applyOptions({ width: chartWidth(el) }); chart.timeScale().fitContent(); } catch (e) {} }
    var er = $('lwRsi');
    if (rsiChart && er) { try { rsiChart.applyOptions({ width: chartWidth(er) }); rsiChart.timeScale().fitContent(); } catch (e) {} }
  }
  var resizeWired = false, resizeObs = null;
  function setupResize() {
    if (resizeWired) return; resizeWired = true;
    window.addEventListener('resize', reflow);
    if ('ResizeObserver' in window) { resizeObs = new ResizeObserver(reflow); try { resizeObs.observe($('lwChart')); } catch (e) {} }
  }

  /* ── ป้อนชุดข้อมูล → วิเคราะห์ + วาดกราฟ ── */
  var lastSource = { kind: 'real' };
  function setSourceBadge(src, days) {
    var el = $('chartSource'); if (!el) return;
    if (src) lastSource = src; else src = lastSource;
    if (src.kind === 'demo') { el.className = 'badge wrap warn'; el.textContent = t('demoSrcBadge'); }
    else if (src.kind === 'paste') { el.className = 'badge wrap'; el.textContent = t('pasteSrcBadge', { n: days }); }
    else { el.className = 'badge wrap ok'; el.textContent = t('realSrcBadge', { src: src.label || t('realPriceLabel'), stale: src.stale ? t('staleLastPrice', { age: cacheAgeText(src.cachedAt) }) : t('realPriceLabel'), n: days }); }
  }
  function useSeries(s, msg, cls, src) {
    lastSeries = s;
    var c = s.closes;
    $('price').value = c[c.length - 1].toFixed(2);
    $('hi').value = Math.max.apply(null, c).toFixed(2);
    $('lo').value = Math.min.apply(null, c).toFixed(2);
    if (msg) setStatus(msg, cls);
    setSourceBadge(src, c.length);
    updatePriceFx();
    if (!$('dcaStart').value) $('dcaStart').value = c[c.length - 1].toFixed(2);
    showAnalysis(analyze(s));
    if (!buildChart(s)) setStatus(t('chartLibFail'), 'err');
  }
  function showAnalysis(a) {
    lastAnalysis = a;
    $('lightCard').style.display = 'block';
    var bulbColors = { green: 'var(--ome-ok)', yellow: 'var(--ome-warn)', red: 'var(--ome-err)' };
    $('light').className = 'light ' + a.light;
    $('bulb').textContent = '';
    $('bulb').style.background = bulbColors[a.light] || 'var(--ome-text-3)';
    $('verdict').textContent = a.verdict;
    $('why').textContent = a.why;
    if (a.det && !a.simple && isFinite(a.det.rsi)) {
      var d = a.det, rows = [
        [t('detEma20'), fmt(d.ema20)], [t('detEma50'), fmt(d.ema50)],
        [t('detRsi'), fmt(d.rsi, 1)], [t('detMacdHist'), fmt(d.macdHist, 3)],
        [t('detBbUpper'), fmt(d.bbUpper)], [t('detBbLower'), fmt(d.bbLower)],
        [t('detAtr'), fmt(d.atr)], [t('detSupport'), fmt(d.support)], [t('detResistance'), fmt(d.resistance)],
        [t('detAdx'), isFinite(d.adx) ? fmt(d.adx, 0) + (d.adx >= 20 ? ' · ' + t('adxStrong') : ' · ' + t('adxWeak')) : '—'],
        [t('detPsar'), d.psar ? fmt(d.psar.sar) + (d.psar.up ? ' · ' + t('psarUp') : ' · ' + t('psarDown')) : '—']
      ], html = '';
      rows.forEach(function (r) { html += '<div class="k">' + esc(r[0]) + '</div><div class="v">' + esc(r[1]) + '</div>'; });
      $('detKv').innerHTML = html;
      $('detailsBox').style.display = 'block';
    } else { $('detailsBox').style.display = 'none'; }
    if (!$('entry').value) $('entry').value = a.price.toFixed(2);
    if (!$('stop').value && isFinite(a.suggestStop)) $('stop').value = a.suggestStop.toFixed(2);
    if (a.light && a.light !== 'gray') {
      $('aiSumCard').style.display = 'block';
      $('aiSumOut').style.display = 'none'; $('aiSumOut').textContent = '';
      setAiSumStatus('', '');
    } else $('aiSumCard').style.display = 'none';
  }
  function setStatus(msg, cls) { var el = $('fetchStatus'); el.textContent = msg; el.className = 'status' + (cls ? ' ' + cls : ''); }

  /* ══════ สรุปราคาบิตคอยน์ด้วย AI (คลาวด์อย่างเดียว — task 'stock:bitcoin') ══════ */
  var AI_SUMMARY_SYSTEM_PROMPT = 'คุณเป็นผู้ช่วยสรุปข้อมูลราคาบิตคอยน์ให้นักลงทุนมือใหม่ชาวไทยฟัง จะได้รับตัวเลข/' +
    'สัญญาณทางเทคนิคที่คำนวณไว้ให้แล้วล่วงหน้า (ห้ามคำนวณหรือเดาตัวเลขเพิ่มเองเด็ดขาด ใช้เฉพาะตัวเลขที่ให้มา) ' +
    'หน้าที่ของคุณคือเรียบเรียงเป็นภาษาพูดที่เข้าใจง่าย ไม่ใช่ผู้แนะนำการลงทุน ' +
    'ตอบเป็นภาษาไทยตามโครงสร้างนี้เท่านั้น (ห้ามขึ้นต้นด้วยคำนำ ให้เริ่มที่ "สรุปภาพรวม:" ทันที):\n\n' +
    'สรุปภาพรวม: (1-2 ประโยค อธิบายสถานะราคาปัจจุบันแบบเข้าใจง่ายจากข้อมูลที่ให้)\n' +
    'ปัจจัยหนุน: (ไม่เกิน 3 ข้อ จากข้อมูลที่ให้เท่านั้น ถ้าไม่มีให้บอกว่า "ไม่มีปัจจัยหนุนเด่นชัดตอนนี้")\n' +
    'ปัจจัยเสี่ยง: (ไม่เกิน 3 ข้อ จากข้อมูลที่ให้เท่านั้น ถ้าไม่มีให้บอกว่า "ไม่มีปัจจัยเสี่ยงเด่นชัดตอนนี้")\n\n' +
    'ห้ามให้คำแนะนำซื้อ/ขาย ห้ามทำนายราคาในอนาคต ห้ามเติมตัวเลขหรือเหตุการณ์ที่ไม่ได้อยู่ในข้อมูลที่ให้มาเด็ดขาด';
  var AI_SUMMARY_REMINDER = 'ย้ำ: ห้ามให้คำแนะนำซื้อ/ขาย ห้ามทำนายราคาในอนาคต ห้ามเติมตัวเลข/เหตุการณ์ที่ไม่ได้อยู่ในข้อมูลที่ให้มา ' +
    'ตอบตามโครงสร้าง 3 หัวข้อที่กำหนดเท่านั้น เริ่มที่ "สรุปภาพรวม:" ทันที ห้ามขึ้นต้นด้วยคำนำ';
  var AI_SUMMARY_SYSTEM_PROMPT_EN = 'You are an assistant who summarizes Bitcoin price data for a novice retail investor. You will be given ' +
    'pre-computed numbers/technical signals (never calculate or guess extra numbers yourself — use only the numbers given). ' +
    'Your job is to phrase this as plain, easy-to-understand language, not as an investment advisor. ' +
    'Reply in English using ONLY this structure (do not start with any preamble — start directly with "Overview:"):\n\n' +
    'Overview: (1-2 sentences explaining the current price status in plain terms, from the data given)\n' +
    'Tailwinds: (up to 3 bullet points, only from the data given — if none, say "No clear tailwinds right now")\n' +
    'Risks: (up to 3 bullet points, only from the data given — if none, say "No clear risks right now")\n\n' +
    'Never give buy/sell advice. Never predict future prices. Never add numbers or events not present in the data given.';
  var AI_SUMMARY_REMINDER_EN = 'Reminder: never give buy/sell advice, never predict future prices, never add numbers/events not present in the data given. ' +
    'Reply using only the 3-section structure above, starting directly with "Overview:" — no preamble.';
  function setAiSumStatus(text, cls) { var el = $('aiSumStatus'); if (!el) return; el.textContent = text || ''; el.className = 'status' + (cls ? ' ' + cls : ''); }
  function buildStockContext() {
    var a = lastAnalysis; if (!a || !a.det) return null;
    var lines = [t('ctxAsset'), t('ctxLatestPrice', { v: fmt(a.price) }), t('ctxVerdict', { v: a.verdict, why: a.why })];
    if (a.prosT && a.prosT.length) lines.push(t('ctxPros', { v: a.prosT.join(', ') }));
    if (a.consT && a.consT.length) lines.push(t('ctxCons', { v: a.consT.join(', ') }));
    var d = a.det || {};
    if (isFinite(d.rsi)) lines.push(t('ctxRsi', { v: fmt(d.rsi, 1) }) + (d.rsi > 70 ? t('ctxRsiHigh') : d.rsi < 38 ? t('ctxRsiLow') : t('ctxRsiMid')));
    if (isFinite(d.macdHist)) lines.push(t('ctxMacd', { v: fmt(d.macdHist, 3) }) + (d.macdHist >= 0 ? t('ctxMacdPos') : t('ctxMacdNeg')));
    if (isFinite(d.ema20) && isFinite(d.ema50)) lines.push(t('ctxEma', { e20: fmt(d.ema20), e50: fmt(d.ema50) }) + (a.uptrend ? t('ctxEmaUp') : t('ctxEmaDn')));
    if (isFinite(d.support)) lines.push(t('ctxSupport', { v: fmt(d.support) }));
    if (isFinite(d.resistance)) lines.push(t('ctxResistance', { v: fmt(d.resistance) }));
    if (isFinite(d.adx)) lines.push(t('ctxAdx', { v: fmt(d.adx, 0) }) + (d.adx >= 20 ? t('ctxAdxStrong') : t('ctxAdxWeak')));
    return lines.join('\n');
  }
  var aiBusy = false;
  function doAiSummary() {
    if (aiBusy) return;
    var ctx = buildStockContext();
    if (!ctx) { setAiSumStatus(t('needStockData'), 'err'); return; }
    aiBusy = true; $('aiSumBtn').disabled = true; $('aiSumOut').style.display = 'none'; $('aiSumOut').textContent = '';
    setAiSumStatus(t('summarizing'), '');
    var en = IC.getLang() === 'en', cached = false;
    IC.summarize({ task: 'stock:bitcoin', onResult: function (r) { cached = !!(r && r.cached); }, messages: [
      { role: 'system', content: en ? AI_SUMMARY_SYSTEM_PROMPT_EN : AI_SUMMARY_SYSTEM_PROMPT },
      { role: 'user', content: ctx },
      { role: 'system', content: en ? AI_SUMMARY_REMINDER_EN : AI_SUMMARY_REMINDER }
    ] }).then(function (text) {
      if (!text) setAiSumStatus(t('summarizeFail'), 'err');
      else { $('aiSumOut').style.display = 'block'; $('aiSumOut').textContent = text; setAiSumStatus(cached ? t('summarizeCached') : '', cached ? 'ok' : ''); }
    }, function (err) { setAiSumStatus(t('summarizeFailWith', { msg: IC.aiMessage(err) }), 'err'); })
      .then(function () { aiBusy = false; $('aiSumBtn').disabled = false; });
  }

  function doAnalyze() {
    if (lastSeries) { useSeries(lastSeries); return; }
    var price = num($('price').value), hi = num($('hi').value), lo = num($('lo').value);
    if (!isFinite(price)) { setStatus(t('errEnterPriceFirst'), 'err'); return; }
    updatePriceFx();
    $('chartCard').style.display = 'none';
    if (isFinite(hi) && isFinite(lo) && hi > lo) showAnalysis(decorate(Calc.analyzeSimple(price, hi, lo)));
    else {
      showAnalysis({ light: 'gray', verdict: t('grayVerdictNeedRange'), why: t('grayWhyNeedRange'), pros: [], cons: [], prosT: [], consT: [], price: price, suggestStop: price * 0.95, resistance: NaN, det: {}, simple: true });
      $('detailsBox').style.display = 'none';
    }
  }

  /* ══════ ข้อมูลตลาดสด (Gateway/Twelve Data) — ตั้งค่าในกล่องเดียวของ InvestCore · คีย์ tanot:market:live-config:v1 เดิม ══════ */
  function setLiveUI(kind, label, meta) {
    var dot = $('marketLiveDot'), title = $('marketLiveLabel'), m = $('marketLiveMeta');
    if (!dot || !title || !m) return;
    dot.className = 'market-live-dot ' + (kind === 'live' ? 'live' : kind === 'delay' ? 'delay' : '');
    title.textContent = label; m.textContent = meta || '';
  }
  function applyLiveQuote(q) {
    lastLive = q;
    var p = $('price'); if (p) { p.value = Number(q.price).toFixed(2); p.dispatchEvent(new Event('input', { bubbles: true })); }
    var e = $('entry'); if (e && !e.value) e.value = Number(q.price).toFixed(2);
    var ch = isFinite(q.change) ? (q.change >= 0 ? '+' : '−') + Number(Math.abs(q.change)).toFixed(2) : '—';
    var pct = isFinite(q.pct) ? ' (' + (q.pct >= 0 ? '+' : '') + Number(q.pct).toFixed(2) + '%)' : '';
    var tm = q.timestamp ? new Date(q.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
    setLiveUI('live', t('marketModeLive'), q.source + ' · ' + ch + pct + ' · ' + t('updatedAt', { time: tm }));
    setStatus(t('priceLiveFrom', { price: Number(q.price).toFixed(2), src: q.source, time: tm }), 'ok');
  }
  function startLive() {
    IC.live.stop();
    var c = IC.live.cfg();
    if (c.provider === 'yahoo') { setLiveUI('', t('marketModeHist'), t('marketMetaHistoricalUse')); return; }
    IC.live.start(SYM, 'btc', applyLiveQuote, function (err) {
      var reason = err && err.message;
      setLiveUI('delay', t('marketModeFallback'), reason ? (t('marketMetaFallback') + ' — ' + reason) : t('marketMetaFallback'));
    });
  }
  function refreshLive() {
    var c = IC.live.cfg();
    if (c.provider === 'yahoo') { setLiveUI('', t('marketModeHist'), t('marketMetaHistoricalUse')); return; }
    IC.live.quote(SYM, 'btc').then(applyLiveQuote, function (err) {
      var reason = err && err.message;
      setLiveUI('delay', t('marketModeFallback'), reason ? (t('marketMetaFallback') + ' — ' + reason) : t('marketMetaFallback'));
    });
  }
  function doFetch() {
    setStatus(t('fetchingSym', { sym: SYM })); $('fetchBtn').disabled = true;
    var c = IC.live.cfg();
    var livePromise = c.provider === 'yahoo' ? Promise.reject(new Error('historical')) : IC.live.quote(SYM, 'btc');
    livePromise.then(function (q) {
      applyLiveQuote(q);
      return IC.series(SYM).then(function (r) { var s = r.series; useSeries(s, t('priceLiveFromSeries', { sym: SYM, src: q.source, n: s.closes.length }), 'ok', { kind: 'real', label: SYM }); });
    }).catch(function () {
      return IC.series(SYM).then(function (r) {
        var s = r.series;
        if (r.stale) useSeries(s, t('staleUseSaved', { age: cacheAgeText(r.cachedAt), n: s.closes.length }), 'ok', { kind: 'real', label: SYM, stale: true, cachedAt: r.cachedAt });
        else useSeries(s, t('historicalFromSrc', { src: 'Yahoo', n: s.closes.length }), 'ok', { kind: 'real', label: SYM });
      });
    }).catch(function () { setStatus(t('fetchFail'), 'err'); }).then(function () { $('fetchBtn').disabled = false; });
  }
  function doDemo() { useSeries(Calc.demoData(45000, undefined, 'btc'), t('demoStatus'), 'ok', { kind: 'demo' }); }
  function doPaste() {
    var s = Calc.parsePaste($('pasteBox').value || '');
    if (!s) { setStatus(t('pasteErrShort'), 'err'); return; }
    useSeries(s, t('pasteOk', { n: s.closes.length }), 'ok', { kind: 'paste' });
  }

  /* ── คำนวณเงิน (USD, BTC เศษส่วน) ── */
  function doCalc() {
    var capital = num($('capital').value), riskPct = num($('riskPct').value);
    var entry = num($('entry').value), stop = num($('stop').value), comm = num($('comm').value);
    if (!isFinite(entry)) entry = num($('price').value);
    if (!isFinite(entry)) { setStatus(t('errNeedEntry'), 'err'); return; }
    if (!isFinite(stop)) { stop = (lastAnalysis && isFinite(lastAnalysis.suggestStop)) ? lastAnalysis.suggestStop : entry * 0.95; $('stop').value = stop.toFixed(2); }
    if (!isFinite(capital) || capital <= 0) { capital = 10000; $('capital').value = capital; }
    if (!isFinite(riskPct) || riskPct <= 0) { riskPct = 1; $('riskPct').value = riskPct; }
    if (!isFinite(comm) || comm < 0) { comm = 0.25; $('comm').value = comm; }
    var res = Calc.riskCalc.btc({ capital: capital, riskPct: riskPct, entry: entry, stop: stop, comm: comm, resistance: lastAnalysis ? lastAnalysis.resistance : NaN });
    var box = $('riskResult');
    if (res.error) {
      $('riskHeadline').innerHTML = '<span class="dn">' + esc(t('riskErrStop')) + '</span>';
      $('riskKv').innerHTML = ''; $('tpRow').innerHTML = ''; box.classList.add('show'); $('saveBtn').style.display = 'none'; return;
    }
    $('riskHeadline').innerHTML = t('calcQtyLine', { qty: fmt(res.qty, 6), sats: fmt0(res.qty * 1e8), cost: usd0(res.cost) }) + fxSpan(res.cost);
    var kv = '';
    kv += '<div class="k">' + esc(t('kvIfWrong')) + '</div><div class="v risk">' + usd0(res.riskUsd) + fxSpan(res.riskUsd) + '</div>';
    kv += '<div class="k">' + esc(t('kvStop')) + '</div><div class="v">' + fmt(stop) + '</div>';
    kv += '<div class="k">' + esc(t('kvBreakeven')) + '</div><div class="v">' + fmt(res.breakeven) + '</div>';
    if (isFinite(res.rr)) kv += '<div class="k">' + esc(t('kvRr')) + '</div><div class="v">' + fmt(res.rr, 1) + ' : 1</div>';
    $('riskKv').innerHTML = kv;
    $('tpRow').innerHTML = '<span class="badge accent">' + esc(t('tpChip1', { v: fmt(res.tp1) })) + '</span><span class="badge accent">' + esc(t('tpChip2', { v: fmt(res.tp2) })) + '</span><span class="badge accent">' + esc(t('tpChip3', { v: fmt(res.tp3) })) + '</span>';
    if (res.note) $('tpRow').innerHTML += '<div class="callout warn">' + esc(t('riskCapLimitedNote')) + '</div>';
    box.classList.add('show');
    $('saveBtn').style.display = 'inline-flex';
    $('saveBtn')._data = { qty: res.qty, cost: entry };
  }

  /* ── พอร์ต (อ่านสด → แก้ → เขียน · แถวอ้างด้วย ts) ── */
  function loadPf() { var a = IC.lsJson(PF_KEY); return Array.isArray(a) ? a : []; }
  function editPf(fn) { var a = loadPf(); fn(a); IC.lsSet(PF_KEY, a); }
  function uniqueTs(a) { var ts = Date.now(); while (a.some(function (r) { return r && r.ts === ts; })) ts++; return ts; }
  var SELL_KEY = { sarDown: 'sellVerdictSar', belowTrend: 'sellVerdictTrend', hotRsi: 'sellVerdictRsi', nearResist: 'sellVerdictResist', hold: 'sellVerdictGo' };
  function sellLevelsHtml(levels, a) {
    var LBL = { sar: 'lvSarLabel', stop: 'lvStopLabel', ema20: 'lvEma20Label', resistance: 'lvResistLabel' };
    var html = '<ul class="sell-levels">';
    levels.forEach(function (lv) {
      var reason;
      switch (lv.reasonCode) {
        case 'sarNoData': reason = t('lvSarReasonNoData'); break;
        case 'sarUp': reason = t('lvSarReasonUp', { v: fmt(lv.price) }); break;
        case 'sarDown': reason = t('lvSarReasonDown'); break;
        case 'stopReason': reason = t('lvStopReason') + (isFinite(lv.atr) ? t('lvStopAtrSuffix', { v: fmt(lv.atr) }) : ''); break;
        case 'stopNoData': reason = t('lvStopReasonNoData'); break;
        case 'ema20': reason = t('lvEma20Reason'); break;
        case 'ema20NoData': reason = t('lvEma20ReasonNoData'); break;
        case 'resist': reason = t('lvResistReason'); break;
        default: reason = t('lvResistReasonNoData');
      }
      html += '<li><div class="row ' + lv.type + '"><span>' + esc(t(LBL[lv.key])) + '</span><span class="price">' + (isFinite(lv.price) ? fmt(lv.price) : '—') + '</span></div><div class="reason">' + esc(reason) + '</div></li>';
    });
    return html + '</ul>';
  }
  function renderPf() {
    var pf = loadPf(), box = $('pfBox');
    if (!pf.length) { box.innerHTML = '<div class="pf-empty">' + esc(t('pfEmptyAlt')) + '</div>'; return; }
    var html = '<div class="table-wrap"><table class="table pf-table"><thead><tr><th>' + esc(t('pfColQty')) + '</th><th>' + esc(t('pfColCost')) + '</th><th>' + esc(t('pfColCur')) + '</th><th>' + esc(t('pfColPl')) + '</th><th></th></tr></thead><tbody>';
    pf.forEach(function (h) {
      html += '<tr data-ts="' + esc(h.ts) + '"><td>' + fmt(h.qty, 6) + '</td><td>' + fmt(h.cost) + '</td>' +
        '<td><input type="number" class="input pf-price" inputmode="decimal" step="0.01" placeholder="' + esc(t('pfPricePh')) + '" value="' + (h.cur != null ? h.cur : '') + '"></td>' +
        '<td class="pf-pl">—</td><td class="pf-actions"><button class="btn sm pf-sell" type="button" title="' + esc(t('pfSellBtnTitle')) + '">' + esc(t('pfSellBtn')) + '</button><button class="btn sm ghost icon pf-del" type="button" title="' + esc(t('pfDelTitle')) + '" aria-label="' + esc(t('pfDelTitle')) + '"><svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-x"/></svg></button></td></tr>' +
        '<tr class="pf-sellrow" data-sr="' + esc(h.ts) + '"><td colspan="5"></td></tr>';
    });
    box.innerHTML = html + '</tbody></table></div>';
    [].forEach.call(box.querySelectorAll('tr[data-ts]'), function (tr) {
      var ts = Number(tr.getAttribute('data-ts')), h = pf.filter(function (x) { return x.ts === ts; })[0];
      var inp = tr.querySelector('.pf-price'), cell = tr.querySelector('.pf-pl');
      var sellCell = box.querySelector('tr[data-sr="' + ts + '"] td');
      function upd() {
        var cur = num(inp.value);
        if (!isFinite(cur)) { cell.textContent = '—'; cell.className = 'pf-pl'; return; }
        var pl = (cur - h.cost) * h.qty, pct = (cur / h.cost - 1) * 100;
        cell.innerHTML = (pl >= 0 ? '+' : '−') + usd0(Math.abs(pl)) + ' (' + (pct >= 0 ? '+' : '') + fmt(pct, 1) + '%)' + fxSpan(pl);
        cell.className = 'pf-pl ' + (pl >= 0 ? 'up' : 'down');
      }
      inp.addEventListener('input', function () { upd(); var v = num(inp.value); editPf(function (a) { a.forEach(function (r) { if (r && r.ts === ts) r.cur = v; }); }); });
      tr.querySelector('.pf-del').addEventListener('click', function () { editPf(function (a) { for (var i = a.length - 1; i >= 0; i--) if (a[i] && a[i].ts === ts) a.splice(i, 1); }); renderPf(); });
      tr.querySelector('.pf-sell').addEventListener('click', function () {
        sellCell.innerHTML = '<div class="callout warn">' + esc(t('pfSellFetching', { sym: SYM })) + '</div>';
        IC.series(SYM).then(function (r) {
          var s = r.series, a = analyze(s), v = Calc.sellVerdict(a), price = s.closes[s.closes.length - 1];
          inp.value = price.toFixed(2); editPf(function (arr) { arr.forEach(function (x) { if (x && x.ts === ts) x.cur = price; }); }); h.cur = price; upd();
          var pl = (price - h.cost) * h.qty, pct = (price / h.cost - 1) * 100;
          sellCell.innerHTML = '<div class="sell-detail"><div class="sell-verdict ' + v.cls + '">' + esc(t(SELL_KEY[v.code])) +
            '<br><span class="sub">' + t('sellDetailPrice', {
              price: fmt(price), stale: r.stale ? t('staleSaved', { age: cacheAgeText(r.cachedAt) }) : '',
              cost: fmt(h.cost), plWord: pl >= 0 ? t('profitWord') : t('lossWord'), pl: usd0(Math.abs(pl)) + fxSpan(pl),
              sign: pct >= 0 ? '+' : '', pct: fmt(pct, 1)
            }) + '</span>' + sellLevelsHtml(v.levels, a) + '</div></div>';
        }, function () {
          sellCell.innerHTML = '<div class="sell-detail"><div class="callout warn">' + esc(t('sellFetchFail', { sym: SYM })) + '</div></div>';
        });
      });
      upd();
    });
  }
  function addHolding() {
    var qty = num($('pfQty').value), cost = num($('pfCost').value);
    if (!isFinite(qty) || qty <= 0 || !isFinite(cost) || cost <= 0) { alert(t('alertPfInvalid')); return; }
    editPf(function (pf) { pf.push({ qty: qty, cost: cost, ts: uniqueTs(pf) }); });
    $('pfQty').value = ''; $('pfCost').value = ''; renderPf();
  }

  /* ── เช็กลิสต์ก่อนเข้าไม้ (GO/NO-GO) — เสี่ยง ≤ 1% + ห้ามเลเวอเรจ ── */
  var btcAnswers = { noLeverage: null };
  var CHK_KEY = { trendUp: 'chkTrendUp', trendDn: 'chkTrendDn', noChase: 'chkNoChase', chasing: 'chkChasing', trendNeedData: 'chkTrendNeedData',
    rsiOk: 'chkRsiOk', rsiHot: 'chkRsiHot', rsiNeedData: 'chkRsiNeedData', stopSet: 'chkStopSet', stopUnset: 'chkStopUnset', riskOk: 'chkRiskOk', riskHigh: 'chkRiskHigh',
    rrOk: 'chkRrOk', rrLow: 'chkRrLow', rrNeedData: 'chkRrNeedData', leverageYes: 'chkLeverageYes', leverageNo: 'chkLeverageNo', leverageUnknown: 'chkLeverageUnknown' };
  function chkText(c) {
    var v = c.vars || {}, txt = t(CHK_KEY[c.code], { v: v.v });
    if ((c.code === 'trendUp' || c.code === 'trendDn') && isFinite(v.adx)) txt += t('chkAdxSuffix', { v: Number(v.adx).toFixed(0), label: v.adxStrong ? t('chkAdxStrong') : t('chkAdxWeak') });
    return txt;
  }
  function doChecklist() {
    var checks = Calc.checklist.btc({ a: lastAnalysis && lastAnalysis.det ? lastAnalysis : null, entry: num($('entry').value), stop: num($('stop').value), riskPct: num($('riskPct').value), answer: btcAnswers.noLeverage });
    var v = Calc.checklistVerdict(checks), el = $('checkVerdict');
    if (v.verdict === 'fail') { el.className = 'callout err'; el.textContent = t('checklistFail', { n: v.fails }); }
    else if (v.verdict === 'unknown') { el.className = 'callout warn'; el.textContent = t('checklistUnknown'); }
    else { el.className = 'callout ok'; el.textContent = t('checklistGo'); }
    IC.renderChecklist($('chkList'), checks, chkText);
    $('checkResult').style.display = 'block';
  }

  /* ── ออม Bitcoin แบบ DCA (คำนวณล้วน ไม่เก็บ state) ── */
  var lastBtcDca = null;
  function drawBtcDcaChart(r) {
    lastBtcDca = r;
    var s = r.series, W = 640, H = 220, pad = 8, n = s.length, val = [], con = [], i;
    if (!n) return;
    for (i = 0; i < n; i++) { val.push(s[i].value); con.push(s[i].contrib); }
    var max = Math.max(val[n - 1], con[n - 1]) || 1;
    var x = function (k) { return pad + k / Math.max(1, n - 1) * (W - 2 * pad); };
    var y = function (v) { return pad + (1 - v / max) * (H - 2 * pad); };
    function path(a) { var d = '', k; for (k = 0; k < a.length; k++) d += (k ? 'L' : 'M') + x(k).toFixed(1) + ' ' + y(a[k]).toFixed(1) + ' '; return d; }
    var area = path(val) + 'L' + x(n - 1).toFixed(1) + ' ' + y(0).toFixed(1) + ' L' + x(0).toFixed(1) + ' ' + y(0).toFixed(1) + ' Z';
    var C = window.OmeChartTheme.get(), svg = '';
    svg += '<path d="' + area + '" fill="' + C.series[1] + '" opacity="0.12"/>';
    svg += '<path d="' + path(con) + '" fill="none" stroke="' + C.axis + '" stroke-width="1.6" stroke-dasharray="5 3"/>';
    svg += '<path d="' + path(val) + '" fill="none" stroke="' + C.series[1] + '" stroke-width="2.4" stroke-linejoin="round"/>';
    $('dcaChart').innerHTML = svg;
  }
  window.OmeChartTheme.onChange(function () { if (lastBtcDca && $('dcaOut').style.display !== 'none') drawBtcDcaChart(lastBtcDca); });
  function dcaYearTable(r) {
    var html = '<div class="table-wrap"><table class="table right"><thead><tr><th>' + esc(t('dcaYrHdYear')) + '</th><th>' + esc(t('dcaYrHdContrib')) + '</th><th>' + esc(t('dcaYrHdQty')) + '</th><th>' + esc(t('dcaYrHdVal')) + '</th></tr></thead><tbody>';
    var yrs = Math.round(r.series.length / 12), i;
    for (i = 1; i <= yrs; i++) {
      var idx = i * 12 - 1; if (idx >= r.series.length) break;
      var row = r.series[idx];
      html += '<tr><td>' + esc(t('dcaYrCol', { n: i })) + '</td><td>' + usd0(row.contrib) + '</td><td>' + fmt(row.qty, 6) + ' BTC</td><td>' + usd0(row.value) + '</td></tr>';
    }
    return html + '</tbody></table></div>';
  }
  function doDCA() {
    var pmt = num($('dcaPmt').value) || 0, startPrice = num($('dcaStart').value), years = num($('dcaYears').value) || 5, cagr = num($('dcaCagr').value);
    if (!isFinite(cagr)) { cagr = 15; $('dcaCagr').value = 15; }
    if (!isFinite(startPrice) || startPrice <= 0) { alert(t('alertDcaStart')); return; }
    if (pmt <= 0) { alert(t('alertDcaPmt')); return; }
    var r = Calc.simulateDCA(pmt, startPrice, cagr, Math.round(years * 12));
    $('dcaOut').style.display = 'block';
    $('dcaContrib').textContent = usd0(r.contrib);
    $('dcaQty').textContent = fmt(r.qty, 6) + ' BTC';
    $('dcaSats').textContent = '≈ ' + fmt0(r.qty * 1e8) + ' sats';
    $('dcaValue').textContent = usd0(r.value);
    $('dcaGain').textContent = (r.value - r.contrib >= 0 ? '+' : '') + usd0(r.value - r.contrib);
    drawBtcDcaChart(r);
    $('dcaYrTable').innerHTML = dcaYearTable(r);
  }

  /* ── init ── */
  function init() {
    applyStaticI18n();
    IC.subnav($('ivSubRow'), 'bitcoin');
    $('fetchBtn').addEventListener('click', doFetch);
    $('marketRefresh').addEventListener('click', refreshLive);
    $('marketSettings').addEventListener('click', function () { IC.live.openSettings(function () { startLive(); }); });
    window.addEventListener('beforeunload', IC.live.stop);
    $('analyzeBtn').addEventListener('click', doAnalyze);
    $('demoBtn').addEventListener('click', doDemo);
    $('pasteBtn').addEventListener('click', doPaste);
    $('calcBtn').addEventListener('click', doCalc);
    ['price', 'hi', 'lo'].forEach(function (id) { $(id).addEventListener('input', function () { lastSeries = null; if (id === 'price') updatePriceFx(); }); });
    $('tfGroup').addEventListener('click', function (e) { var b = e.target.closest('.tf'); if (b) applyTF(+b.getAttribute('data-tf')); });
    $('tgGroup').addEventListener('click', function (e) { var b = e.target.closest('.tg'); if (!b) return; var k = b.getAttribute('data-tg'); tg[k] = !tg[k]; applyToggles(); });
    $('saveBtn').addEventListener('click', function () {
      var d = $('saveBtn')._data; if (!d) return;
      editPf(function (pf) { pf.push({ qty: d.qty, cost: d.cost, ts: uniqueTs(pf) }); });
      renderPf();
      $('saveBtn').textContent = t('savedToPfDone');
      setTimeout(function () { $('saveBtn').textContent = t('saveToPfBtn'); }, 1500);
    });
    $('chkForm').addEventListener('click', function (e) {
      var btn = e.target.closest('.yn-btn'); if (!btn) return;
      var row = btn.closest('.yn-row'), key = row.getAttribute('data-key'), val = btn.getAttribute('data-val');
      btcAnswers[key] = val;
      [].forEach.call(row.querySelectorAll('.yn-btn'), function (b) { b.classList.remove('on', 'yes', 'no'); });
      btn.classList.add('on', val);
    });
    $('checkBtn').addEventListener('click', doChecklist);
    $('pfAdd').addEventListener('click', addHolding);
    $('dcaBtn').addEventListener('click', doDCA);
    $('aiSumBtn').addEventListener('click', doAiSummary);
    var fxc = IC.lsJson(Calc.FX_KEY); if (fxc && isFinite(fxc.rate)) { fxRate = fxc.rate; $('fxRate').value = fxc.rate.toFixed(2); }
    $('fxFetchBtn').addEventListener('click', doFxFetch);
    $('fxRate').addEventListener('input', function () { fxRate = num($('fxRate').value); updatePriceFx(); if ($('riskResult').classList.contains('show')) doCalc(); renderPf(); });
    $('fxShowChk').addEventListener('change', function () { updatePriceFx(); if ($('riskResult').classList.contains('show')) doCalc(); renderPf(); });
    renderPf(); runFng(); startLive();
    IC.onLang(function () {
      applyStaticI18n(); IC.subnav($('ivSubRow'), 'bitcoin');
      if (lastFng) renderFngValue(lastFng.value, lastFng.classification, 'real', lastFng.stale ? t('fngStaleSrc', { age: cacheAgeText(lastFng.ts) }) : t('fngLiveSrc'));
      if ($('lightCard').style.display !== 'none') doAnalyze();
      renderPf();
      if ($('riskResult').classList.contains('show')) doCalc();
      if ($('checkResult').style.display !== 'none') doChecklist();
      if ($('dcaOut').style.display !== 'none') doDCA();
      startLive();
    });
    if (window.TanotData && window.TanotData.onChange) window.TanotData.onChange(function () {
      var a = document.activeElement;
      if (a && a.classList && a.classList.contains('pf-price')) return; /* กำลังพิมพ์ราคาปัจจุบัน — ไม่วาดทับ */
      renderPf();
    });
  }
  init();
})();
