/* ══════════════════════════════════════════════════════════════════
   Tanot — ค่าเงิน & วัตถุดิบ (แท็บ #markets ของ invest-gold.html) — ยุบรวมหน้าลงทุน ขั้น 9
   เนื้อหาเดิมของหน้า invest-commodities ทั้งหมด: การ์ดสถิติ + ปุ่มเลือก 16 สินทรัพย์ + กราฟแท่งเทียน/เส้น + ไฟจราจร + AI + คุมเงิน + เช็กลิสต์ + ตารางย้อนหลัง
   • ราคา/ซีรีส์ผ่าน InvestCore (quote → cache:q:<sym> · series → seriesKey) · ทองไทยใช้ InvestCore.thaiGold() ตัวเดียวกับแท็บทองคำ (cache:gold:th)
   • คู่ cross (เยน/ยูโร/หยวนเทียบบาท) คำนวณจาก 2 ticker จริง ไม่เดาตัวเลข
   • วิเคราะห์/คุมเงิน/เช็กลิสต์: InvestCalc.analyzeSeries · riskCalc.markets · checklist.markets (หน่วยของสินทรัพย์ที่เลือก)
   • AI คลาวด์อย่างเดียว (task 'stock:commodities')
   เรียกผ่าน window.InvestMarkets.init() ครั้งแรกที่เปิดแท็บ (invest-gold.js)
   หมายเหตุ: ตัวช่วยดูภาพรวมราคา ไม่ใช่คำแนะนำการลงทุน
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var IC = window.InvestCore, Calc = window.InvestCalc;
  var inited = false;
  var E = function (n) { return document.getElementById('mk_' + n); };
  var esc = IC.esc;

  var L = IC.i18n({
    th: {
      rcKvNote: 'หมายเหตุ', srcBadgeEod: 'ข้อมูล EOD (วันก่อนหน้า)', loadingDefault: 'กำลังโหลด…',
      ohlcOpen: 'เปิด', ohlcHigh: 'สูง', ohlcLow: 'ต่ำ', ohlcClose: 'ปิด', ohlcChg: 'เปลี่ยนแปลง',
      tf1m: '1เดือน', tf3m: '3เดือน', tf6m: '6เดือน', tf1y: '1ปี', chartCapUp: 'แท่งขึ้น', chartCapDown: 'แท่งลง',
      histTitleDefault: 'ข้อมูลราคาย้อนหลัง', histTitleWithAsset: 'ข้อมูลราคา {label} — ล่าสุด {n} วัน',
      histThDate: 'วันที่', histThOpen: 'เปิด', histThHigh: 'สูง', histThLow: 'ต่ำ', histThClose: 'ปิด', histThChg: 'เปลี่ยนแปลง',
      fetchFailShort: 'ดึงไม่ได้', goldNoHistEmpty: 'ราคาทองไทยไม่มีข้อมูลย้อนหลังจากแหล่งฟรี', goldNoHistTitle: 'ราคาทองไทยไม่มีข้อมูลย้อนหลังจากแหล่งฟรี',
      goldLiveToday: 'ราคาสดวันนี้', goldStale: 'ดึงสดไม่ได้ — ใช้ราคาที่บันทึกไว้ล่าสุด', goldFail: 'ดึงราคาทองไทยไม่ได้ตอนนี้',
      loadingChart: 'กำลังโหลดกราฟ…', seriesReal: 'ราคาจาก Yahoo Finance', seriesStale: 'ดึงสดไม่ได้ — ใช้ข้อมูลที่บันทึกไว้ล่าสุด',
      chartLibFail: 'โหลดไลบรารีกราฟไม่ได้ (ลองออนไลน์แล้วรีเฟรช)',
      seriesFail: 'ดึงข้อมูลไม่สำเร็จตอนนี้ — ลองรีเฟรชอีกครั้ง หรือเลือกสินทรัพย์อื่นก่อน',
      chartEmptyFail: 'ดึงกราฟไม่ได้ตอนนี้', histTitleFail: 'ดึงข้อมูลราคาย้อนหลังไม่ได้ตอนนี้',
      groupFx: 'ค่าเงิน', groupMetal: 'ทองคำ & โลหะ', groupEnergy: 'พลังงาน', groupAgri: 'เกษตร',
      labelUsdthb: 'บาทดอลลาร์', labelGc: 'ทองคำ COMEX', labelGoldbar: 'ทองคำแท่ง', labelGoldjew: 'ทองรูปพรรณ',
      labelWti: 'น้ำมัน WTI', labelBrent: 'น้ำมันดิบ Brent', labelNg: 'ก๊าซธรรมชาติ', labelCopper: 'ทองแดง',
      labelSteel: 'เหล็ก (HRC)', labelSugar: 'น้ำตาลทราย', labelCoffee: 'กาแฟ', labelRice: 'ข้าว (Rough Rice)',
      labelDxy: 'ดัชนีดอลลาร์', labelJpythb: 'เยนเทียบบาท', labelEurthb: 'ยูโรเทียบบาท', labelCnythb: 'หยวนเทียบบาท',
      unitUsdthb: 'บาท/USD', unitGc: 'USD/ออนซ์', unitGoldw: 'บาท/บาททองคำ', unitOilBbl: 'USD/บาร์เรล',
      unitNg: 'USD/MMBtu', unitCopper: 'USD/ปอนด์', unitSteel: 'USD/ตันสั้น', unitCentLb: 'เซนต์/ปอนด์',
      unitRice: 'USD/100cwt', unitDxy: 'จุด', unitJpythb: 'บาท/100เยน', unitEurthb: 'บาท/ยูโร', unitCnythb: 'บาท/หยวน',
      verdictTitle: 'ถูก/แพงเทียบแนวโน้ม', gVerdictNoData: 'ยังไม่มีข้อมูล', techDetailsSummary: 'ดูรายละเอียดทางเทคนิค',
      detEma20: 'เส้นเฉลี่ย 20 วัน (EMA20)', detEma50: 'เส้นเฉลี่ย 50 วัน (EMA50)', detRsi: 'RSI (14)', detMacd: 'MACD histogram',
      detSupport: 'แนวรับล่าสุด', detResistance: 'แนวต้านล่าสุด', detAdx: 'ความแรงแนวโน้ม (ADX 14)', detAdxStrong: ' · แข็งแรง', detAdxWeak: ' · อ่อน', detNoData: '—',
      whyCheapRange: 'ราคาอยู่ช่วงถูกเทียบ 3 เดือน', whyExpensiveRange: 'ราคาอยู่ช่วงแพงเทียบ 3 เดือน',
      whyRsiLow: 'แรงขายเริ่มคลาย (RSI ต่ำ กำลังฟื้น)', whyRsiHigh: 'ราคาร้อนแรงเกินไป (RSI สูง เสี่ยงย่อ)',
      whyMomUp: 'โมเมนตัมเริ่มกลับเป็นบวก', whyMomDn: 'โมเมนตัมเริ่มอ่อนลง',
      whyUptrend: 'ยังอยู่ในแนวโน้มขึ้น', whyDowntrend: 'อยู่ใต้เส้นแนวโน้ม (ขาลง/พักตัว)',
      whyBbLow: 'ราคาแตะกรอบล่าง (มักเป็นจังหวะเด้ง)', whyBbHigh: 'ราคาชนกรอบบน', whyNeutral: 'ราคาอยู่กลางกรอบ ยังไม่มีสัญญาณชัด',
      vInteresting: 'น่าสนใจ — ราคาอยู่ในโซนถูกเทียบแนวโน้ม', vCareful: 'ระวัง — ราคาแพงเทียบแนวโน้ม', vMid: 'กลางๆ — ยังไม่มีจังหวะเด่น',
      aiSumTitle: 'สรุปด้วย AI', aiSumBtn: 'สรุปให้หน่อย', needStockData: 'ยังไม่มีข้อมูลราคาให้สรุป — รอข้อมูลราคาโหลดก่อนนะครับ',
      summarizing: 'กำลังสรุป…', summarizeFail: 'สรุปไม่สำเร็จ ลองอีกครั้ง', summarizeFailWith: 'สรุปไม่สำเร็จ: {msg}',
      summarizeCached: 'ผลสรุปนี้คำนวณไว้แล้ว (โหลดจากแคช ไม่ต้องเรียก AI ใหม่)',
      ctxAsset: 'สินทรัพย์: {label} (หน่วย {unit})', ctxLatestPrice: 'ราคาล่าสุด: {v} {unit}', ctxVerdict: 'สัญญาณไฟจราจรที่คำนวณแล้ว: {v} ({why})',
      ctxPros: 'ปัจจัยหนุนที่ตรวจพบ: {v}', ctxCons: 'ปัจจัยเสี่ยงที่ตรวจพบ: {v}',
      ctxRsi: 'RSI (14 วัน): {v}', ctxRsiHigh: ' (สูง/ร้อนแรง)', ctxRsiLow: ' (ต่ำ/แรงขายเริ่มคลาย)', ctxRsiMid: ' (กลางๆ)',
      ctxMacd: 'MACD histogram: {v}', ctxMacdPos: ' (เป็นบวก)', ctxMacdNeg: ' (เป็นลบ)',
      ctxEma: 'เส้นเฉลี่ย 20 วัน: {e20}, เส้นเฉลี่ย 50 วัน: {e50}', ctxEmaUp: ' (ราคาอยู่เหนือเส้นเฉลี่ย — แนวโน้มขึ้น)', ctxEmaDn: ' (ราคาอยู่ใต้เส้นเฉลี่ย — แนวโน้มลง/พักตัว)',
      ctxSupport: 'แนวรับล่าสุด: {v}', ctxResistance: 'แนวต้านล่าสุด: {v}',
      ctxAdx: 'ความแรงแนวโน้ม (ADX): {v}', ctxAdxStrong: ' (แข็งแรง)', ctxAdxWeak: ' (อ่อน)',
      rcTitle: 'ถ้าจะซื้อ ควรใส่เงินเท่าไร ตั้งขายที่ไหน', rcCapitalLabel: 'เงินลงทุนทั้งหมด', rcCapitalPh: 'เช่น 100000',
      rcRiskPctLabel: 'ยอมเสี่ยงต่อครั้ง', rcUnitPctPortfolio: '(% ของพอร์ต)', rcEntryLabel: 'ราคาซื้อ', rcEntryPh: '= ราคาปัจจุบันของสินทรัพย์ที่เลือก',
      rcStopLabel: 'ราคาตัดขาดทุน', rcStopPh: 'แนะนำอัตโนมัติ', rcCalcBtn: 'คำนวณ',
      rcErrNeedEntry: 'กรอกราคาซื้อ (หรือรอราคาปัจจุบันโหลด) ก่อน', rcErrStop: 'ราคาตัดขาดทุนต้องต่ำกว่าราคาซื้อ',
      rcCapLimitedNote: 'จำกัดจำนวนตามเงินที่มี (ทุนไม่พอซื้อเท่าที่ความเสี่ยงอนุญาต)',
      rcQtyLine: 'ควรซื้อได้ประมาณ <b>{qty} หน่วย</b> ใช้เงิน ≈ <b>{cost}</b>',
      rcKvIfWrong: 'ถ้าผิดทาง (แตะ Stop) เสียไม่เกิน', rcKvStop: 'ราคาตัดขาดทุน (Stop)', rcKvRr: 'ความคุ้ม (กำไรคาดหวัง : ความเสี่ยง) ถึงแนวต้าน',
      checklistTitle: 'เช็กลิสต์ก่อนซื้อ — ควรซื้อไหม?',
      chkLeverageQ: 'ยืนยันว่าเข้าใจความเสี่ยงเลเวอเรจ/มาร์จิ้นของสัญญาที่จะซื้อ (เช่น ฟิวเจอร์ส/CFD) และไม่ใช้เลเวอเรจเกินที่รับความเสี่ยงได้',
      ynYes: 'ใช่', ynNo: 'ยัง', checkBtn: 'ตรวจเช็กลิสต์',
      chkTrendUp: 'อยู่ในแนวโน้มขึ้น (ราคาเหนือเส้นเฉลี่ย)', chkTrendDn: 'ยังไม่อยู่ในแนวโน้มขึ้น (ราคาใต้เส้นเฉลี่ย)',
      chkAdxSuffix: ' · ADX {v} {label}', chkAdxStrong: 'เทรนด์แข็งแรง', chkAdxWeak: 'เทรนด์อ่อน ควรระวัง',
      chkNoChase: 'ไม่ไล่ราคา (ห่างเส้นเฉลี่ย 20 ไม่เกิน 5%)', chkChasing: 'กำลังไล่ราคา (สูงกว่าเส้นเฉลี่ย 20 เกิน 5%)',
      chkTrendNeedData: 'แนวโน้ม/การไล่ราคา: ต้องรอข้อมูลราคาโหลดก่อน',
      chkRsiOk: 'ไม่ร้อนแรงเกิน (RSI {v})', chkRsiHot: 'ร้อนแรงเกินไป (RSI {v} ≥ 70) เสี่ยงย่อ', chkRsiNeedData: 'RSI: ต้องรอข้อมูลราคาโหลดก่อน',
      chkStopSet: 'ตั้งจุดตัดขาดทุน (Stop) แล้ว', chkStopUnset: 'ยังไม่ตั้งจุดตัดขาดทุน — กด "คำนวณ" ด้านบนก่อน',
      chkRiskOk: 'เสี่ยงต่อครั้ง ≤ 2% ({v}%)', chkRiskHigh: 'เสี่ยงต่อครั้งสูงไป ({v}) — ควร ≤ 2%',
      chkRrOk: 'กำไรคาดหวัง:เสี่ยง ≥ 2:1 ({v}:1)', chkRrLow: 'กำไร:เสี่ยงน้อยไป ({v}:1) — ควร ≥ 2:1',
      chkRrNeedData: 'กำไร:เสี่ยง: ต้องมีแนวต้านจากกราฟ + ตั้ง Stop ก่อน',
      chkLeverageYes: 'ยืนยันแล้วว่าเข้าใจความเสี่ยงเลเวอเรจ/มาร์จิ้น และไม่ใช้เลเวอเรจเกินตัว',
      chkLeverageNo: 'ยังไม่เข้าใจ/อาจใช้เลเวอเรจเกินตัว — เสี่ยงถูกบังคับปิดสถานะจากความผันผวนระยะสั้น',
      chkLeverageUnknown: 'ยืนยันก่อนว่าเข้าใจความเสี่ยงเลเวอเรจ/มาร์จิ้นของสัญญาที่จะซื้อ (กดปุ่มด้านบน)',
      checklistFail: 'ยังไม่ควรซื้อ — ติด {n} ข้อ ควรแก้ให้ครบก่อนซื้อ',
      checklistUnknown: 'ข้อมูลไม่พอประเมินครบ — กด "คำนวณ" ด้านบนและตอบคำถามก่อน',
      checklistGo: 'ซื้อได้ตามแผน — ผ่านครบทุกข้อ (แต่ยังไม่การันตีกำไร ทำตามแผนและตัดขาดทุนเสมอ)'
    },
    en: {
      rcKvNote: 'Note', srcBadgeEod: 'EOD data (previous day)', loadingDefault: 'Loading…',
      ohlcOpen: 'Open', ohlcHigh: 'High', ohlcLow: 'Low', ohlcClose: 'Close', ohlcChg: 'Change',
      tf1m: '1M', tf3m: '3M', tf6m: '6M', tf1y: '1Y', chartCapUp: 'Up candle', chartCapDown: 'Down candle',
      histTitleDefault: 'Price history', histTitleWithAsset: 'Price history for {label} — last {n} days',
      histThDate: 'Date', histThOpen: 'Open', histThHigh: 'High', histThLow: 'Low', histThClose: 'Close', histThChg: 'Change',
      fetchFailShort: 'Unavailable', goldNoHistEmpty: 'No free historical data for Thai gold price', goldNoHistTitle: 'No free historical data for Thai gold price',
      goldLiveToday: "Today's live price", goldStale: 'Live fetch failed — using last saved price', goldFail: "Couldn't fetch Thai gold price right now",
      loadingChart: 'Loading chart…', seriesReal: 'Price from Yahoo Finance', seriesStale: 'Live fetch failed — using last saved data',
      chartLibFail: "Couldn't load the chart library (try again online and refresh)",
      seriesFail: "Couldn't fetch data right now — try refreshing, or pick another asset first",
      chartEmptyFail: "Couldn't fetch the chart right now", histTitleFail: "Couldn't fetch price history right now",
      groupFx: 'FX', groupMetal: 'Gold & Metals', groupEnergy: 'Energy', groupAgri: 'Agriculture',
      labelUsdthb: 'USD/THB', labelGc: 'Gold (COMEX)', labelGoldbar: 'Gold Bar (Thai)', labelGoldjew: 'Gold Jewelry (Thai)',
      labelWti: 'WTI Crude Oil', labelBrent: 'Brent Crude Oil', labelNg: 'Natural Gas', labelCopper: 'Copper',
      labelSteel: 'Steel (HRC)', labelSugar: 'Sugar', labelCoffee: 'Coffee', labelRice: 'Rice (Rough Rice)',
      labelDxy: 'US Dollar Index', labelJpythb: 'JPY/THB', labelEurthb: 'EUR/THB', labelCnythb: 'CNY/THB',
      unitUsdthb: 'THB/USD', unitGc: 'USD/oz', unitGoldw: 'THB/baht-weight', unitOilBbl: 'USD/barrel',
      unitNg: 'USD/MMBtu', unitCopper: 'USD/lb', unitSteel: 'USD/short ton', unitCentLb: 'cents/lb',
      unitRice: 'USD/100cwt', unitDxy: 'points', unitJpythb: 'THB/100 JPY', unitEurthb: 'THB/EUR', unitCnythb: 'THB/CNY',
      verdictTitle: 'Cheap/expensive vs. trend', gVerdictNoData: 'No data yet', techDetailsSummary: 'View technical details',
      detEma20: '20-day MA (EMA20)', detEma50: '50-day MA (EMA50)', detRsi: 'RSI (14)', detMacd: 'MACD histogram',
      detSupport: 'Latest support', detResistance: 'Latest resistance', detAdx: 'Trend strength (ADX 14)', detAdxStrong: ' · strong', detAdxWeak: ' · weak', detNoData: '—',
      whyCheapRange: 'Price is in the cheap part of the 3-month range', whyExpensiveRange: 'Price is in the expensive part of the 3-month range',
      whyRsiLow: 'Selling pressure easing (RSI low, starting to recover)', whyRsiHigh: 'Price is overheated (RSI high, risk of a pullback)',
      whyMomUp: 'Momentum is turning positive', whyMomDn: 'Momentum is weakening',
      whyUptrend: 'Still in an uptrend', whyDowntrend: 'Below the trend line (downtrend/consolidation)',
      whyBbLow: 'Price is touching the lower band (often a bounce point)', whyBbHigh: 'Price is hitting the upper band', whyNeutral: 'Price is in the middle of the range, no clear signal yet',
      vInteresting: 'Interesting — price is in a cheap zone relative to the trend', vCareful: 'Careful — price is expensive relative to the trend', vMid: 'Neutral — no standout opportunity yet',
      aiSumTitle: 'AI Summary', aiSumBtn: 'Summarize It', needStockData: 'No price data to summarize yet — wait for the price data to load first',
      summarizing: 'Summarizing…', summarizeFail: 'Summary failed, try again', summarizeFailWith: 'Summary failed: {msg}',
      summarizeCached: 'Already summarized (loaded from cache — no new AI call needed)',
      ctxAsset: 'Asset: {label} (unit: {unit})', ctxLatestPrice: 'Latest price: {v} {unit}', ctxVerdict: 'Computed signal: {v} ({why})',
      ctxPros: 'Detected tailwinds: {v}', ctxCons: 'Detected risks: {v}',
      ctxRsi: 'RSI (14-day): {v}', ctxRsiHigh: ' (high/overheated)', ctxRsiLow: ' (low/selling pressure easing)', ctxRsiMid: ' (neutral)',
      ctxMacd: 'MACD histogram: {v}', ctxMacdPos: ' (positive)', ctxMacdNeg: ' (negative)',
      ctxEma: '20-day MA: {e20}, 50-day MA: {e50}', ctxEmaUp: ' (price above the MAs — uptrend)', ctxEmaDn: ' (price below the MAs — downtrend/consolidation)',
      ctxSupport: 'Latest support: {v}', ctxResistance: 'Latest resistance: {v}',
      ctxAdx: 'Trend strength (ADX): {v}', ctxAdxStrong: ' (strong)', ctxAdxWeak: ' (weak)',
      rcTitle: 'If you buy, how much should you put in, and where should you sell', rcCapitalLabel: 'Total capital', rcCapitalPh: 'e.g. 100000',
      rcRiskPctLabel: 'Risk tolerance per purchase', rcUnitPctPortfolio: '(% of portfolio)', rcEntryLabel: 'Purchase price', rcEntryPh: "= this asset's current price",
      rcStopLabel: 'Stop-loss price', rcStopPh: 'Auto-suggested', rcCalcBtn: 'Calculate',
      rcErrNeedEntry: 'Enter the purchase price first (or wait for the current price to load)', rcErrStop: 'The stop-loss price must be below the purchase price',
      rcCapLimitedNote: 'Limited by available funds (capital is not enough to buy the full amount the risk setting would allow)',
      rcQtyLine: 'You could buy about <b>{qty} unit(s)</b> using ≈ <b>{cost}</b>',
      rcKvIfWrong: 'If wrong (hits Stop), you lose no more than', rcKvStop: 'Stop-loss price (Stop)', rcKvRr: 'Reward:risk to resistance',
      checklistTitle: 'Pre-purchase check — should you buy?',
      chkLeverageQ: "Confirm you understand the leverage/margin risk of the instrument you're buying (e.g. futures/CFD) and aren't over-leveraged for your risk tolerance",
      ynYes: 'Yes', ynNo: 'Not yet', checkBtn: 'Check the checklist',
      chkTrendUp: 'In an uptrend (price above the moving average)', chkTrendDn: 'Not yet in an uptrend (price below the moving average)',
      chkAdxSuffix: ' · ADX {v} {label}', chkAdxStrong: 'strong trend', chkAdxWeak: 'weak trend, be careful',
      chkNoChase: 'Not chasing the price (within 5% of the 20-day average)', chkChasing: 'Chasing the price (more than 5% above the 20-day average)',
      chkTrendNeedData: 'Trend/price-chasing: needs the price data to load first',
      chkRsiOk: 'Not overheated (RSI {v})', chkRsiHot: 'Overheated (RSI {v} ≥ 70), risk of a pullback', chkRsiNeedData: 'RSI: needs the price data to load first',
      chkStopSet: 'Stop-loss (Stop) is set', chkStopUnset: 'Stop-loss not set yet — press "Calculate" above first',
      chkRiskOk: 'Risk per purchase ≤ 2% ({v}%)', chkRiskHigh: 'Risk per purchase is too high ({v}) — should be ≤ 2%',
      chkRrOk: 'Reward:risk ≥ 2:1 ({v}:1)', chkRrLow: 'Reward:risk too low ({v}:1) — should be ≥ 2:1',
      chkRrNeedData: 'Reward:risk: needs resistance from the chart + a Stop set first',
      chkLeverageYes: "Confirmed: understands the leverage/margin risk and isn't over-leveraged",
      chkLeverageNo: 'Not yet understood/possibly over-leveraged — risk of forced liquidation from short-term volatility',
      chkLeverageUnknown: 'Confirm first that you understand the leverage/margin risk of the instrument (press the button above)',
      checklistFail: 'Not ready to buy yet — {n} item(s) failed; fix them all before buying',
      checklistUnknown: 'Not enough information to fully assess — press "Calculate" above and answer the questions first',
      checklistGo: 'Ready to buy per plan — passed every item (still no profit guarantee — follow the plan and always cut losses)'
    }
  });
  var t = L.t;

  /* ── รายการสินทรัพย์ — kind: 'yahoo' ticker เดี่ยว · 'cross' คำนวณจาก 2 ticker · 'thaigold' ทองไทย (ไม่มีกราฟย้อนหลัง) ── */
  var GROUPS = [{ key: 'fx', labelKey: 'groupFx' }, { key: 'metal', labelKey: 'groupMetal' }, { key: 'energy', labelKey: 'groupEnergy' }, { key: 'agri', labelKey: 'groupAgri' }];
  var ASSETS = [
    { key: 'usdthb', labelKey: 'labelUsdthb', icon: '', kind: 'yahoo', sym: 'THB=X', unitKey: 'unitUsdthb', dp: 3, group: 'fx' },
    { key: 'gc', labelKey: 'labelGc', icon: '', kind: 'yahoo', sym: 'GC=F', unitKey: 'unitGc', dp: 1, group: 'metal' },
    { key: 'goldbar', labelKey: 'labelGoldbar', icon: '▬', kind: 'thaigold', field: 'barBuyPrice', unitKey: 'unitGoldw', dp: 0, group: 'metal' },
    { key: 'goldjew', labelKey: 'labelGoldjew', icon: '', kind: 'thaigold', field: 'jewelryBuyPrice', unitKey: 'unitGoldw', dp: 0, group: 'metal' },
    { key: 'wti', labelKey: 'labelWti', icon: '', kind: 'yahoo', sym: 'CL=F', unitKey: 'unitOilBbl', dp: 2, group: 'energy' },
    { key: 'brent', labelKey: 'labelBrent', icon: '', kind: 'yahoo', sym: 'BZ=F', unitKey: 'unitOilBbl', dp: 2, group: 'energy' },
    { key: 'ng', labelKey: 'labelNg', icon: '', kind: 'yahoo', sym: 'NG=F', unitKey: 'unitNg', dp: 3, group: 'energy' },
    { key: 'copper', labelKey: 'labelCopper', icon: '', kind: 'yahoo', sym: 'HG=F', unitKey: 'unitCopper', dp: 3, group: 'metal' },
    { key: 'steel', labelKey: 'labelSteel', icon: '', kind: 'yahoo', sym: 'HRC=F', unitKey: 'unitSteel', dp: 1, group: 'metal' },
    { key: 'sugar', labelKey: 'labelSugar', icon: '', kind: 'yahoo', sym: 'SB=F', unitKey: 'unitCentLb', dp: 2, group: 'agri' },
    { key: 'coffee', labelKey: 'labelCoffee', icon: '', kind: 'yahoo', sym: 'KC=F', unitKey: 'unitCentLb', dp: 2, group: 'agri' },
    { key: 'rice', labelKey: 'labelRice', icon: '', kind: 'yahoo', sym: 'ZR=F', unitKey: 'unitRice', dp: 2, group: 'agri' },
    { key: 'dxy', labelKey: 'labelDxy', icon: '', kind: 'yahoo', sym: 'DX-Y.NYB', unitKey: 'unitDxy', dp: 2, group: 'fx' },
    { key: 'jpythb', labelKey: 'labelJpythb', icon: '🇯🇵', kind: 'cross', a: 'THB=X', b: 'JPY=X', op: 'div', mul: 100, unitKey: 'unitJpythb', dp: 3, group: 'fx' },
    { key: 'eurthb', labelKey: 'labelEurthb', icon: '🇪🇺', kind: 'cross', a: 'EURUSD=X', b: 'THB=X', op: 'mul', mul: 1, unitKey: 'unitEurthb', dp: 3, group: 'fx' },
    { key: 'cnythb', labelKey: 'labelCnythb', icon: '🇨🇳', kind: 'cross', a: 'THB=X', b: 'CNY=X', op: 'div', mul: 1, unitKey: 'unitCnythb', dp: 3, group: 'fx' }
  ];
  var byKey = {}; ASSETS.forEach(function (a) { byKey[a.key] = a; });
  var STAT_KEYS = ['usdthb', 'gc', 'goldbar', 'goldjew', 'wti'];
  function assetLabel(a) { return t(a.labelKey); }
  function assetUnit(a) { return t(a.unitKey); }

  var LAST_KEY = 'tanot:invest:comm:lastKey';
  var curKey = null, curTF = 63, curType = 'candle';
  var chart = null, seriesObj = null, LWC = null, fullData = null, lastAnalysis = null, answer = null;
  var CT = window.OmeChartTheme;

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }
  function fmt(n, d) { return IC.fmt(n, d == null ? 2 : d); }

  /* ══ โครงหน้า (สร้างครั้งแรกที่เปิดแท็บ) ══ */
  function panelHtml() {
    return '<div class="card">' +
      '<div><span class="badge ok" data-i18n="srcBadgeEod"></span></div>' +
      '<div class="stat-row" id="mk_statRow"></div><div class="pill-row" id="mk_pillRow"></div></div>' +
    '<div class="card">' +
      '<div class="detail-hd"><div class="detail-title row"><span class="ic" id="mk_dIcon"></span><div><div class="nm" id="mk_dName">—</div><div class="unit" id="mk_dUnit"></div></div></div>' +
        '<div class="segmented" id="mk_ctypeGroup"><button class="on" data-ct="candle" type="button">Candle</button><button data-ct="line" type="button">Line</button></div></div>' +
      '<div class="badge wrap" id="mk_dSrcBadge" data-i18n="loadingDefault"></div>' +
      '<div class="ohlc-row" id="mk_ohlcRow" style="display:none">' +
        '<div class="ohlc-box"><div class="k" data-i18n="ohlcOpen"></div><div class="v" id="mk_oOpen">—</div></div>' +
        '<div class="ohlc-box"><div class="k" data-i18n="ohlcHigh"></div><div class="v" id="mk_oHigh">—</div></div>' +
        '<div class="ohlc-box"><div class="k" data-i18n="ohlcLow"></div><div class="v" id="mk_oLow">—</div></div>' +
        '<div class="ohlc-box"><div class="k" data-i18n="ohlcClose"></div><div class="v" id="mk_oClose">—</div></div>' +
        '<div class="ohlc-box"><div class="k" data-i18n="ohlcChg"></div><div class="v" id="mk_oChg">—</div></div></div>' +
      '<div class="segmented" id="mk_tfGroup" style="align-self:flex-start"><button class="tf" data-tf="21" type="button" data-i18n="tf1m"></button><button class="tf on" data-tf="63" type="button" data-i18n="tf3m"></button><button class="tf" data-tf="126" type="button" data-i18n="tf6m"></button><button class="tf" data-tf="252" type="button" data-i18n="tf1y"></button></div>' +
      '<div class="lw-chart" id="mk_lwChart"></div><div id="mk_chartEmpty" class="chart-empty" style="display:none"></div>' +
      '<div class="chart-cap" id="mk_chartCap" style="display:none"><span><i class="sw-up"></i><span data-i18n="chartCapUp"></span></span><span><i class="sw-dn"></i><span data-i18n="chartCapDown"></span></span></div></div>' +
    '<div class="card"><h2 data-i18n="verdictTitle"></h2>' +
      '<div class="light gray" id="mk_vLight"><div class="bulb" id="mk_vBulb"></div><div><div class="verdict" id="mk_vVerdict" data-i18n="loadingDefault"></div><div class="why" id="mk_vWhy"></div></div></div>' +
      '<details class="disclosure" id="mk_vDetailsBox" style="display:none"><summary data-i18n="techDetailsSummary"></summary><div class="disclosure-body"><div class="kv" id="mk_vDetKv"></div></div></details></div>' +
    '<div class="card" id="mk_aiSumCard" style="display:none"><h2 data-i18n="aiSumTitle"></h2>' +
      '<button class="btn primary sm" id="mk_aiSumBtn" type="button" data-i18n="aiSumBtn"></button><div class="status" id="mk_aiSumStatus" style="margin:0"></div>' +
      '<div class="callout" id="mk_aiSumOut" style="display:none;font-weight:400;line-height:1.75;white-space:pre-wrap"></div></div>' +
    '<div class="card"><h2 data-i18n="rcTitle"></h2>' +
      '<div class="frow"><div class="field"><label for="mk_rcCapital" data-i18n="rcCapitalLabel"></label><input class="input" type="number" id="mk_rcCapital" inputmode="decimal" step="1" data-i18n-placeholder="rcCapitalPh"></div>' +
        '<div class="field"><label for="mk_rcRiskPct"><span data-i18n="rcRiskPctLabel"></span> <span class="unit" data-i18n="rcUnitPctPortfolio"></span></label><input class="input" type="number" id="mk_rcRiskPct" inputmode="decimal" step="0.1" value="2"></div></div>' +
      '<div class="frow"><div class="field"><label for="mk_rcEntry" data-i18n="rcEntryLabel"></label><input class="input" type="number" id="mk_rcEntry" inputmode="decimal" step="any" data-i18n-placeholder="rcEntryPh"></div>' +
        '<div class="field"><label for="mk_rcStop" data-i18n="rcStopLabel"></label><input class="input" type="number" id="mk_rcStop" inputmode="decimal" step="any" data-i18n-placeholder="rcStopPh"></div></div>' +
      '<div><button class="btn primary sm" id="mk_rcCalcBtn" type="button" data-i18n="rcCalcBtn"></button></div>' +
      '<div id="mk_rcResult" style="display:none;border-top:1px dashed var(--ome-border);padding-top:14px"><div id="mk_rcHeadline" class="big-out"></div><div class="kv" id="mk_rcKv"></div></div></div>' +
    '<div class="card"><h2 data-i18n="checklistTitle"></h2>' +
      '<div id="mk_chkForm"><div class="yn-row" data-key="noLeverage"><span data-i18n="chkLeverageQ"></span><span class="segmented yn-btns"><button class="yn-btn" data-val="yes" type="button" data-i18n="ynYes"></button><button class="yn-btn" data-val="no" type="button" data-i18n="ynNo"></button></span></div></div>' +
      '<div><button class="btn sm" id="mk_checkBtn" type="button" data-i18n="checkBtn"></button></div>' +
      '<div id="mk_checkResult" style="display:none"><div class="callout" id="mk_checkVerdict"></div><ul class="chk-list" id="mk_chkList"></ul></div></div>' +
    '<div class="card"><h2><span id="mk_histTitle" data-i18n="histTitleDefault"></span></h2><div class="table-wrap"><table class="table right hist-table" id="mk_histTable"></table></div></div>';
  }

  /* ══ การ์ดสรุป ══ */
  function sparkSvg(vals, up) {
    if (!vals || vals.length < 2) return '';
    var w = 100, h = 28, min = Math.min.apply(null, vals), max = Math.max.apply(null, vals), range = Math.max(1e-9, max - min), i, pts = [];
    for (i = 0; i < vals.length; i++) pts.push((i / (vals.length - 1) * w).toFixed(1) + ',' + (h - (vals[i] - min) / range * (h - 4) - 2).toFixed(1));
    var C = CT.get(), color = up ? C.up : C.down;
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none"><polyline points="' + pts.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  }
  function cardEl(a) { return document.querySelector('#mk_statRow .stat-card[data-key="' + a.key + '"]'); }
  function writeCard(a, price, chgPct, spark) {
    var el = cardEl(a); if (!el) return;
    var prEl = el.querySelector('.pr'), chgEl = el.querySelector('.chg'), sparkEl = el.querySelector('.spark');
    if (!isFinite(price)) { prEl.textContent = t('fetchFailShort'); prEl.className = 'pr na'; chgEl.textContent = ''; if (sparkEl) sparkEl.innerHTML = ''; return; }
    prEl.textContent = fmt(price, a.dp); prEl.className = 'pr';
    if (isFinite(chgPct)) { chgEl.textContent = (chgPct >= 0 ? '▲' : '▼') + fmt(Math.abs(chgPct), 2) + '%'; chgEl.className = 'chg ' + (chgPct > 0 ? 'up' : chgPct < 0 ? 'dn' : 'flat'); }
    else chgEl.textContent = '';
    if (sparkEl) sparkEl.innerHTML = sparkSvg(spark, !(isFinite(chgPct) && chgPct < 0));
  }
  function crossVal(a, va, vb) { var r = a.op === 'mul' ? va * vb : va / vb; return r * (a.mul || 1); }
  function loadCardQuote(a) {
    if (a.kind === 'yahoo') {
      return IC.quote(a.sym).then(function (q) { writeCard(a, q.price, isFinite(q.prev) && q.prev ? (q.price / q.prev - 1) * 100 : NaN, q.spark); }, function () { writeCard(a, NaN, NaN); });
    }
    if (a.kind === 'cross') {
      return Promise.all([IC.quote(a.a), IC.quote(a.b)]).then(function (r) {
        var qa = r[0], qb = r[1], now = crossVal(a, qa.price, qb.price);
        var prev = crossVal(a, isFinite(qa.prev) ? qa.prev : qa.price, isFinite(qb.prev) ? qb.prev : qb.price);
        writeCard(a, now, isFinite(prev) && prev ? (now / prev - 1) * 100 : NaN);
      }, function () { writeCard(a, NaN, NaN); });
    }
    return IC.thaiGold().then(function (g) { writeCard(a, g[a.field], NaN); }, function () { writeCard(a, NaN, NaN); });
  }
  function buildGrid() {
    var statHtml = '';
    STAT_KEYS.forEach(function (k) {
      var a = byKey[k];
      statHtml += '<button type="button" class="stat-card" data-key="' + a.key + '"><span class="ic">' + a.icon + '</span><span class="nm">' + esc(assetLabel(a)) + '</span><span class="pr na">' + esc(t('loadingDefault')) + '</span><span class="chg"></span><span class="spark"></span></button>';
    });
    E('statRow').innerHTML = statHtml;
    var pillHtml = '';
    GROUPS.forEach(function (g) {
      var items = ASSETS.filter(function (a) { return a.group === g.key; });
      pillHtml += '<div class="pill-group"><span class="pill-group-lbl">' + esc(t(g.labelKey)) + '</span><div class="pill-group-row">' +
        items.map(function (a) { return '<button type="button" class="chip" data-key="' + a.key + '"><span class="ic">' + a.icon + '</span>' + esc(assetLabel(a)) + '</button>'; }).join('') + '</div></div>';
    });
    E('pillRow').innerHTML = pillHtml;
    /* ทยอยยิงเฉพาะ 5 ตัวในแถวสถิติ (ตัวอื่นดึงตอนกดเลือก) กัน proxy โดน rate-limit */
    IC.sequence(STAT_KEYS, function (k) { return loadCardQuote(byKey[k]); }, 180);
  }

  /* ══ กราฟ ══ */
  function chartWidth(el) { return Math.max(240, (el && (el.clientWidth || el.offsetWidth)) || 320); }
  function baseOpts(w, h) { var o = CT.lightweight(); o.width = w; o.height = h; o.localization = { locale: 'en-US' }; o.timeScale.rightOffset = 3; o.timeScale.fixLeftEdge = true; return o; }
  var themeWired = false, resizeWired = false;
  function recolor() { if (!chart || !seriesObj) return; chart.applyOptions(CT.lightweight()); seriesObj.applyOptions(curType === 'candle' ? CT.candles() : { color: CT.get().series[0] }); }
  function reflow() { var el = E('lwChart'); if (chart && el) { try { chart.applyOptions({ width: chartWidth(el) }); chart.timeScale().fitContent(); } catch (e) {} } }
  function ohlcAt(s, i) { return { time: s.times[i], open: s.opens[i], high: s.highs[i], low: s.lows[i], close: s.closes[i] }; }
  function toCandleData(s) { var out = [], i; for (i = 0; i < s.times.length; i++) out.push(ohlcAt(s, i)); return out; }
  function toLineData(s) { var out = [], i; for (i = 0; i < s.times.length; i++) out.push({ time: s.times[i], value: s.closes[i] }); return out; }
  function buildChart() {
    if (!window.LightweightCharts) return false;
    LWC = window.LightweightCharts;
    if (chart) { try { chart.remove(); } catch (e) {} chart = null; seriesObj = null; }
    var el = E('lwChart'); el.innerHTML = '';
    E('chartEmpty').style.display = 'none'; E('chartCap').style.display = 'flex'; el.style.display = 'block';
    chart = LWC.createChart(el, baseOpts(chartWidth(el), 260));
    seriesObj = curType === 'candle' ? chart.addCandlestickSeries(Object.assign({ borderVisible: false }, CT.candles())) : chart.addLineSeries({ color: CT.get().series[0], lineWidth: 2 });
    applyTF(curTF);
    if (!themeWired) { themeWired = true; CT.onChange(recolor); }
    if (!resizeWired) { resizeWired = true; window.addEventListener('resize', reflow); if ('ResizeObserver' in window) { try { new ResizeObserver(reflow).observe(E('lwChart')); } catch (e) {} } }
    if (window.requestAnimationFrame) requestAnimationFrame(reflow);
    setTimeout(reflow, 120);
    return true;
  }
  function applyTF(n) {
    curTF = n;
    if (!fullData || !seriesObj) return;
    var start = Math.max(0, fullData.times.length - n);
    var sub = { times: fullData.times.slice(start), opens: fullData.opens.slice(start), highs: fullData.highs.slice(start), lows: fullData.lows.slice(start), closes: fullData.closes.slice(start) };
    seriesObj.setData(curType === 'candle' ? toCandleData(sub) : toLineData(sub));
    chart.timeScale().fitContent();
    updateOhlcRow(sub);
    [].forEach.call(document.querySelectorAll('#mk_tfGroup .tf'), function (b) { b.classList.toggle('on', +b.getAttribute('data-tf') === n); });
  }
  function updateOhlcRow(sub) {
    var n = sub.closes.length; if (!n) return;
    var last = ohlcAt(sub, n - 1), prevClose = n >= 2 ? sub.closes[n - 2] : last.open, chg = last.close - prevClose, pct = prevClose ? chg / prevClose * 100 : NaN;
    var dp = byKey[curKey] ? byKey[curKey].dp : 2;
    E('oOpen').textContent = fmt(last.open, dp); E('oHigh').textContent = fmt(last.high, dp); E('oLow').textContent = fmt(last.low, dp); E('oClose').textContent = fmt(last.close, dp);
    var chgEl = E('oChg');
    chgEl.textContent = (chg >= 0 ? '+' : '') + fmt(chg, dp) + (isFinite(pct) ? ' (' + (pct >= 0 ? '+' : '') + fmt(pct, 2) + '%)' : '');
    chgEl.className = 'v ' + (chg > 0 ? 'up' : chg < 0 ? 'dn' : '');
    E('ohlcRow').style.display = 'grid';
  }

  /* ══ ตารางย้อนหลัง 30 วัน ══ */
  var HIST_DAYS = 30;
  function renderHistTable(s, a) {
    E('histTitle').textContent = t('histTitleWithAsset', { label: assetLabel(a), n: Math.min(HIST_DAYS, s.times.length) });
    var tbl = E('histTable'), n = s.times.length;
    if (!n) { tbl.innerHTML = ''; return; }
    var rows = '', i;
    for (i = n - 1; i >= Math.max(0, n - HIST_DAYS); i--) {
      var bar = ohlcAt(s, i), prevClose = i > 0 ? s.closes[i - 1] : bar.open, chg = bar.close - prevClose, pct = prevClose ? chg / prevClose * 100 : NaN;
      rows += '<tr><td>' + IC.date(new Date(bar.time), { day: 'numeric', month: 'short', year: 'numeric' }) + '</td><td>' + fmt(bar.open, a.dp) + '</td>' +
        '<td class="hi">' + fmt(bar.high, a.dp) + '</td><td class="lo">' + fmt(bar.low, a.dp) + '</td><td>' + fmt(bar.close, a.dp) + '</td>' +
        '<td class="chg ' + (chg > 0 ? 'up' : chg < 0 ? 'dn' : '') + '">' + (chg >= 0 ? '+' : '') + fmt(chg, a.dp) + (isFinite(pct) ? ' (' + (pct >= 0 ? '+' : '') + fmt(pct, 2) + '%)' : '') + '</td></tr>';
    }
    tbl.innerHTML = '<thead><tr><th>' + esc(t('histThDate')) + '</th><th>' + esc(t('histThOpen')) + '</th><th>' + esc(t('histThHigh')) + '</th><th>' + esc(t('histThLow')) + '</th><th>' + esc(t('histThClose')) + '</th><th>' + esc(t('histThChg')) + '</th></tr></thead><tbody>' + rows + '</tbody>';
  }
  /* series ของ InvestCore (มี ohlc) → รูปแบบที่หน้านี้ใช้ */
  function fromCore(s) { return { times: s.times, opens: s.ohlc.map(function (b) { return b.open; }), highs: s.highs, lows: s.lows, closes: s.closes }; }
  /* cross: จับคู่ 2 series ตามวันที่ตรงกัน ประมาณค่าต่อองค์ประกอบ OHLC (วิธีทั่วไปของกราฟ cross-rate โดยประมาณ) */
  function crossSeries(a, sa, sb) {
    var mapB = {}, i;
    for (i = 0; i < sb.times.length; i++) mapB[sb.times[i]] = ohlcAt(sb, i);
    var out = { times: [], opens: [], highs: [], lows: [], closes: [] };
    for (i = 0; i < sa.times.length; i++) {
      var bBar = mapB[sa.times[i]]; if (!bBar) continue;
      var aBar = ohlcAt(sa, i);
      out.times.push(sa.times[i]); out.opens.push(crossVal(a, aBar.open, bBar.open)); out.highs.push(crossVal(a, aBar.high, bBar.high));
      out.lows.push(crossVal(a, aBar.low, bBar.low)); out.closes.push(crossVal(a, aBar.close, bBar.close));
    }
    return out;
  }

  /* ══ ไฟจราจร ══ */
  var WHY_KEY = { cheapRange: 'whyCheapRange', expensiveRange: 'whyExpensiveRange', rsiLow: 'whyRsiLow', rsiHigh: 'whyRsiHigh', momUp: 'whyMomUp', momDn: 'whyMomDn',
    uptrend: 'whyUptrend', downtrend: 'whyDowntrend', bbLow: 'whyBbLow', bbHigh: 'whyBbHigh', neutral: 'whyNeutral' };
  function decorate(a) {
    a.verdict = t(a.light === 'green' ? 'vInteresting' : a.light === 'red' ? 'vCareful' : 'vMid');
    a.why = t(WHY_KEY[a.why] || 'whyNeutral');
    a.prosT = a.pros.map(function (c) { return t(WHY_KEY[c] || 'whyNeutral'); });
    a.consT = a.cons.map(function (c) { return t(WHY_KEY[c] || 'whyNeutral'); });
    return a;
  }
  function setAiSumStatus(text, cls) { var el = E('aiSumStatus'); if (!el) return; el.textContent = text || ''; el.className = 'status' + (cls ? ' ' + cls : ''); }
  function showVerdict(a, asset) {
    if (a) lastAnalysis = a;
    if (!a) {
      E('vLight').className = 'light gray'; E('vBulb').style.background = 'var(--ome-text-3)';
      E('vVerdict').textContent = t('gVerdictNoData'); E('vWhy').textContent = ''; E('vDetailsBox').style.display = 'none'; E('aiSumCard').style.display = 'none';
      return;
    }
    var bulbColors = { green: 'var(--ome-ok)', yellow: 'var(--ome-warn)', red: 'var(--ome-err)' };
    E('vLight').className = 'light ' + a.light; E('vBulb').style.background = bulbColors[a.light] || 'var(--ome-text-3)';
    E('vVerdict').textContent = a.verdict; E('vWhy').textContent = a.why;
    if (a.det && isFinite(a.det.rsi)) {
      var d = a.det, dp = asset.dp, rows = [
        [t('detEma20'), fmt(d.ema20, dp)], [t('detEma50'), fmt(d.ema50, dp)], [t('detRsi'), fmt(d.rsi, 1)], [t('detMacd'), fmt(d.macdHist, 4)],
        [t('detSupport'), fmt(d.support, dp)], [t('detResistance'), fmt(d.resistance, dp)],
        [t('detAdx'), isFinite(d.adx) ? fmt(d.adx, 0) + (d.adx >= 20 ? t('detAdxStrong') : t('detAdxWeak')) : t('detNoData')]
      ], html = '';
      rows.forEach(function (r) { html += '<div class="k">' + esc(r[0]) + '</div><div class="v">' + esc(r[1]) + '</div>'; });
      E('vDetKv').innerHTML = html; E('vDetailsBox').style.display = 'block';
    } else E('vDetailsBox').style.display = 'none';
    E('aiSumCard').style.display = 'block'; E('aiSumOut').style.display = 'none'; E('aiSumOut').textContent = ''; setAiSumStatus('', '');
  }

  /* ══ คุมเงิน/เช็กลิสต์ — หน่วยของสินทรัพย์ที่เลือก ══ */
  function doCalc() {
    var asset = byKey[curKey]; if (!asset) return;
    var capital = num(E('rcCapital').value), riskPct = num(E('rcRiskPct').value), entry = num(E('rcEntry').value), stop = num(E('rcStop').value);
    E('rcResult').style.display = 'block';
    if (!isFinite(entry)) { entry = (lastAnalysis && isFinite(lastAnalysis.price)) ? lastAnalysis.price : NaN; if (isFinite(entry)) E('rcEntry').value = entry.toFixed(asset.dp); }
    if (!isFinite(entry)) { E('rcHeadline').innerHTML = '<span style="color:var(--ome-err-ink)">' + esc(t('rcErrNeedEntry')) + '</span>'; E('rcKv').innerHTML = ''; return; }
    if (!isFinite(stop)) { stop = (lastAnalysis && isFinite(lastAnalysis.suggestStop)) ? lastAnalysis.suggestStop : entry * 0.95; E('rcStop').value = stop.toFixed(asset.dp); }
    if (!isFinite(capital) || capital <= 0) { capital = 100000; E('rcCapital').value = capital; }
    if (!isFinite(riskPct) || riskPct <= 0) { riskPct = 2; E('rcRiskPct').value = riskPct; }
    var res = Calc.riskCalc.markets({ capital: capital, riskPct: riskPct, entry: entry, stop: stop, resistance: lastAnalysis ? lastAnalysis.resistance : NaN });
    if (res.error) { E('rcHeadline').innerHTML = '<span style="color:var(--ome-err-ink)">' + esc(t('rcErrStop')) + '</span>'; E('rcKv').innerHTML = ''; return; }
    E('rcHeadline').innerHTML = t('rcQtyLine', { qty: fmt(res.qty, 4), cost: fmt(res.cost, 0) });
    var kv = '<div class="k">' + esc(t('rcKvIfWrong')) + '</div><div class="v">' + fmt(res.riskAmt, 0) + '</div>';
    kv += '<div class="k">' + esc(t('rcKvStop')) + '</div><div class="v">' + fmt(stop, asset.dp) + '</div>';
    if (isFinite(res.rr)) kv += '<div class="k">' + esc(t('rcKvRr')) + '</div><div class="v">' + fmt(res.rr, 1) + ' : 1</div>';
    if (res.note) kv += '<div class="k" style="color:var(--ome-warn-ink)">' + esc(t('rcKvNote')) + '</div><div class="v" style="color:var(--ome-warn-ink);font-size:var(--ome-fs-xs)">' + esc(t('rcCapLimitedNote')) + '</div>';
    E('rcKv').innerHTML = kv;
  }
  var CHK_KEY = { trendUp: 'chkTrendUp', trendDn: 'chkTrendDn', noChase: 'chkNoChase', chasing: 'chkChasing', trendNeedData: 'chkTrendNeedData',
    rsiOk: 'chkRsiOk', rsiHot: 'chkRsiHot', rsiNeedData: 'chkRsiNeedData', stopSet: 'chkStopSet', stopUnset: 'chkStopUnset', riskOk: 'chkRiskOk', riskHigh: 'chkRiskHigh',
    rrOk: 'chkRrOk', rrLow: 'chkRrLow', rrNeedData: 'chkRrNeedData', leverageYes: 'chkLeverageYes', leverageNo: 'chkLeverageNo', leverageUnknown: 'chkLeverageUnknown' };
  function chkText(c) {
    var v = c.vars || {}, txt = t(CHK_KEY[c.code], { v: v.v });
    if ((c.code === 'trendUp' || c.code === 'trendDn') && isFinite(v.adx)) txt += t('chkAdxSuffix', { v: Number(v.adx).toFixed(0), label: v.adxStrong ? t('chkAdxStrong') : t('chkAdxWeak') });
    return txt;
  }
  function doChecklist() {
    var checks = Calc.checklist.markets({ a: lastAnalysis && lastAnalysis.det ? lastAnalysis : null, entry: num(E('rcEntry').value), stop: num(E('rcStop').value), riskPct: num(E('rcRiskPct').value), answer: answer });
    var v = Calc.checklistVerdict(checks), el = E('checkVerdict');
    if (v.verdict === 'fail') { el.className = 'callout err'; el.textContent = t('checklistFail', { n: v.fails }); }
    else if (v.verdict === 'unknown') { el.className = 'callout warn'; el.textContent = t('checklistUnknown'); }
    else { el.className = 'callout ok'; el.textContent = t('checklistGo'); }
    IC.renderChecklist(E('chkList'), checks, chkText);
    E('checkResult').style.display = 'block';
  }

  /* ══ สรุปด้วย AI (คลาวด์อย่างเดียว — task 'stock:commodities') ══ */
  var AI_SUMMARY_SYSTEM_PROMPT = 'คุณเป็นผู้ช่วยสรุปข้อมูลราคาสินค้าโภคภัณฑ์/ค่าเงินให้นักลงทุนมือใหม่ชาวไทยฟัง จะได้รับตัวเลข/' +
    'สัญญาณทางเทคนิคที่คำนวณไว้ให้แล้วล่วงหน้า (ห้ามคำนวณหรือเดาตัวเลขเพิ่มเองเด็ดขาด ใช้เฉพาะตัวเลขที่ให้มา) ' +
    'หน้าที่ของคุณคือเรียบเรียงเป็นภาษาพูดที่เข้าใจง่าย ไม่ใช่ผู้แนะนำการลงทุน ' +
    'ตอบเป็นภาษาไทยตามโครงสร้างนี้เท่านั้น (ห้ามขึ้นต้นด้วยคำนำ ให้เริ่มที่ "สรุปภาพรวม:" ทันที):\n\n' +
    'สรุปภาพรวม: (1-2 ประโยค อธิบายสถานะราคาปัจจุบันแบบเข้าใจง่ายจากข้อมูลที่ให้)\n' +
    'ปัจจัยหนุน: (ไม่เกิน 3 ข้อ จากข้อมูลที่ให้เท่านั้น ถ้าไม่มีให้บอกว่า "ไม่มีปัจจัยหนุนเด่นชัดตอนนี้")\n' +
    'ปัจจัยเสี่ยง: (ไม่เกิน 3 ข้อ จากข้อมูลที่ให้เท่านั้น ถ้าไม่มีให้บอกว่า "ไม่มีปัจจัยเสี่ยงเด่นชัดตอนนี้")\n\n' +
    'ห้ามให้คำแนะนำซื้อ/ขาย ห้ามทำนายราคาในอนาคต ห้ามเติมตัวเลขหรือเหตุการณ์ที่ไม่ได้อยู่ในข้อมูลที่ให้มาเด็ดขาด';
  var AI_SUMMARY_REMINDER = 'ย้ำ: ห้ามให้คำแนะนำซื้อ/ขาย ห้ามทำนายราคาในอนาคต ห้ามเติมตัวเลข/เหตุการณ์ที่ไม่ได้อยู่ในข้อมูลที่ให้มา ' +
    'ตอบตามโครงสร้าง 3 หัวข้อที่กำหนดเท่านั้น เริ่มที่ "สรุปภาพรวม:" ทันที ห้ามขึ้นต้นด้วยคำนำ';
  var AI_SUMMARY_SYSTEM_PROMPT_EN = 'You are an assistant who summarizes commodity/FX price data for a novice retail investor. You will be given ' +
    'pre-computed numbers/technical signals (never calculate or guess extra numbers yourself — use only the numbers given). ' +
    'Your job is to phrase this as plain, easy-to-understand language, not as an investment advisor. ' +
    'Reply in English using ONLY this structure (do not start with any preamble — start directly with "Overview:"):\n\n' +
    'Overview: (1-2 sentences explaining the current price status in plain terms, from the data given)\n' +
    'Tailwinds: (up to 3 bullet points, only from the data given — if none, say "No clear tailwinds right now")\n' +
    'Risks: (up to 3 bullet points, only from the data given — if none, say "No clear risks right now")\n\n' +
    'Never give buy/sell advice. Never predict future prices. Never add numbers or events not present in the data given.';
  var AI_SUMMARY_REMINDER_EN = 'Reminder: never give buy/sell advice, never predict future prices, never add numbers/events not present in the data given. ' +
    'Reply using only the 3-section structure above, starting directly with "Overview:" — no preamble.';
  function buildAiSumContext() {
    var a = lastAnalysis; if (!a || !curKey) return null;
    var asset = byKey[curKey]; if (!asset) return null;
    var unit = assetUnit(asset), label = assetLabel(asset), dp = asset.dp;
    var lines = [t('ctxAsset', { label: label, unit: unit }), t('ctxLatestPrice', { v: fmt(a.price, dp), unit: unit }), t('ctxVerdict', { v: a.verdict, why: a.why })];
    if (a.prosT && a.prosT.length) lines.push(t('ctxPros', { v: a.prosT.join(', ') }));
    if (a.consT && a.consT.length) lines.push(t('ctxCons', { v: a.consT.join(', ') }));
    var d = a.det || {};
    if (isFinite(d.rsi)) lines.push(t('ctxRsi', { v: fmt(d.rsi, 1) }) + (d.rsi > 70 ? t('ctxRsiHigh') : d.rsi < 38 ? t('ctxRsiLow') : t('ctxRsiMid')));
    if (isFinite(d.macdHist)) lines.push(t('ctxMacd', { v: fmt(d.macdHist, 4) }) + (d.macdHist >= 0 ? t('ctxMacdPos') : t('ctxMacdNeg')));
    if (isFinite(d.ema20) && isFinite(d.ema50)) lines.push(t('ctxEma', { e20: fmt(d.ema20, dp), e50: fmt(d.ema50, dp) }) + (a.uptrend ? t('ctxEmaUp') : t('ctxEmaDn')));
    if (isFinite(d.support)) lines.push(t('ctxSupport', { v: fmt(d.support, dp) }));
    if (isFinite(d.resistance)) lines.push(t('ctxResistance', { v: fmt(d.resistance, dp) }));
    if (isFinite(d.adx)) lines.push(t('ctxAdx', { v: fmt(d.adx, 0) }) + (d.adx >= 20 ? t('ctxAdxStrong') : t('ctxAdxWeak')));
    return lines.join('\n');
  }
  var aiBusy = false;
  function doAiSummary() {
    if (aiBusy) return;
    var ctx = buildAiSumContext();
    if (!ctx) { setAiSumStatus(t('needStockData'), 'err'); return; }
    aiBusy = true; E('aiSumBtn').disabled = true; E('aiSumOut').style.display = 'none'; E('aiSumOut').textContent = ''; setAiSumStatus(t('summarizing'), '');
    var en = IC.getLang() === 'en', cached = false;
    IC.summarize({ task: 'stock:commodities', onResult: function (r) { cached = !!(r && r.cached); }, messages: [
      { role: 'system', content: en ? AI_SUMMARY_SYSTEM_PROMPT_EN : AI_SUMMARY_SYSTEM_PROMPT },
      { role: 'user', content: ctx },
      { role: 'system', content: en ? AI_SUMMARY_REMINDER_EN : AI_SUMMARY_REMINDER }
    ] }).then(function (text) {
      if (!text) setAiSumStatus(t('summarizeFail'), 'err');
      else { E('aiSumOut').style.display = 'block'; E('aiSumOut').textContent = text; setAiSumStatus(cached ? t('summarizeCached') : '', cached ? 'ok' : ''); }
    }, function (err) { setAiSumStatus(t('summarizeFailWith', { msg: IC.aiMessage(err) }), 'err'); })
      .then(function () { aiBusy = false; E('aiSumBtn').disabled = false; });
  }

  /* ══ เลือกสินทรัพย์ ══ */
  function setDetailStatus(msg, cls) { var el = E('dSrcBadge'); el.textContent = msg; el.className = 'badge wrap' + (cls === 'real' ? ' ok' : cls === 'demo' ? ' warn' : ''); }
  function selectAsset(key) {
    var a = byKey[key]; if (!a) return;
    var switching = curKey !== key;
    curKey = key;
    try { localStorage.setItem(LAST_KEY, key); } catch (e) {}
    [].forEach.call(document.querySelectorAll('#panel-markets .stat-card, #panel-markets .chip'), function (el) { el.classList.toggle('on', el.getAttribute('data-key') === key); });
    E('dIcon').textContent = a.icon; E('dName').textContent = assetLabel(a); E('dUnit').textContent = assetUnit(a);
    E('ohlcRow').style.display = 'none'; fullData = null;
    E('vLight').className = 'light gray'; E('vBulb').style.background = 'var(--ome-text-3)';
    E('vVerdict').textContent = t('loadingDefault'); E('vWhy').textContent = ''; E('vDetailsBox').style.display = 'none'; E('aiSumCard').style.display = 'none';
    /* คนละหน่วย/สกุล — ล้างช่องราคา/ผลลัพธ์เมื่อสลับสินทรัพย์จริงเท่านั้น (สลับภาษาไม่ล้าง) */
    if (switching) { E('rcEntry').value = ''; E('rcStop').value = ''; E('rcResult').style.display = 'none'; E('checkResult').style.display = 'none'; lastAnalysis = null; }

    if (a.kind === 'thaigold') {
      setDetailStatus(t('loadingDefault'));
      if (chart) { try { chart.remove(); } catch (e) {} chart = null; seriesObj = null; }
      E('lwChart').style.display = 'none'; E('chartCap').style.display = 'none';
      E('chartEmpty').style.display = 'block'; E('chartEmpty').textContent = t('goldNoHistEmpty');
      E('histTitle').textContent = t('goldNoHistTitle'); E('histTable').innerHTML = '';
      showVerdict(null);
      IC.thaiGold().then(function (g) {
        if (curKey !== key) return;
        setDetailStatus(g.stale ? t('goldStale') : t('goldLiveToday') + (g.updateDate ? (' · ' + g.updateDate) : ''), 'real');
        writeCard(a, g[a.field], NaN);
      }, function () { if (curKey === key) setDetailStatus(t('goldFail'), 'paste'); });
      return;
    }
    setDetailStatus(t('loadingChart'));
    E('lwChart').style.display = 'none'; E('chartEmpty').style.display = 'block'; E('chartEmpty').textContent = t('loadingDefault');
    var p = a.kind === 'yahoo'
      ? IC.series(a.sym).then(function (r) { return { s: fromCore(r.series), stale: r.stale }; })
      : Promise.all([IC.series(a.a), IC.series(a.b)]).then(function (r) { return { s: crossSeries(a, fromCore(r[0].series), fromCore(r[1].series)), stale: r[0].stale || r[1].stale }; });
    p.then(function (r) {
      if (curKey !== key) return; /* ผู้ใช้กดตัวอื่นไปแล้วระหว่างรอ */
      if (!r.s.times.length) throw new Error('empty');
      fullData = r.s;
      setDetailStatus(r.stale ? t('seriesStale') : t('seriesReal'), 'real');
      if (!buildChart()) setDetailStatus(t('chartLibFail'), 'paste');
      renderHistTable(r.s, a);
      showVerdict(decorate(Calc.analyzeSeries(r.s, { psar: false })), a);
    }, function () {
      if (curKey !== key) return;
      setDetailStatus(t('seriesFail'), 'paste');
      E('chartEmpty').textContent = t('chartEmptyFail'); E('histTitle').textContent = t('histTitleFail'); E('histTable').innerHTML = '';
      showVerdict(null);
    });
  }

  function init() {
    if (inited) return; inited = true;
    var panel = document.getElementById('panel-markets');
    panel.innerHTML = panelHtml();
    L.apply(panel);
    buildGrid();
    panel.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.stat-card, .chip');
      if (b && panel.contains(b)) selectAsset(b.getAttribute('data-key'));
    });
    [].forEach.call(panel.querySelectorAll('#mk_tfGroup .tf'), function (b) { b.addEventListener('click', function () { applyTF(+b.getAttribute('data-tf')); }); });
    [].forEach.call(panel.querySelectorAll('#mk_ctypeGroup button'), function (b) {
      b.addEventListener('click', function () {
        curType = b.getAttribute('data-ct');
        [].forEach.call(panel.querySelectorAll('#mk_ctypeGroup button'), function (x) { x.classList.toggle('on', x === b); });
        if (fullData) buildChart();
      });
    });
    E('aiSumBtn').addEventListener('click', doAiSummary);
    E('rcCalcBtn').addEventListener('click', doCalc);
    E('chkForm').addEventListener('click', function (e) {
      var btn = e.target.closest('.yn-btn'); if (!btn) return;
      var row = btn.closest('.yn-row'), val = btn.getAttribute('data-val');
      answer = val;
      [].forEach.call(row.querySelectorAll('.yn-btn'), function (b) { b.classList.remove('on', 'yes', 'no'); });
      btn.classList.add('on', val);
    });
    E('checkBtn').addEventListener('click', doChecklist);
    IC.onLang(function () {
      L.apply(panel); buildGrid();
      if (curKey) selectAsset(curKey);
      if (E('rcResult').style.display !== 'none') doCalc();
      if (E('checkResult').style.display !== 'none') doChecklist();
    });
    var last = null; try { last = localStorage.getItem(LAST_KEY); } catch (e) {}
    selectAsset(byKey[last] ? last : 'gc');
  }

  window.InvestMarkets = { init: init, crossVal: crossVal, ASSETS: ASSETS };
})();
