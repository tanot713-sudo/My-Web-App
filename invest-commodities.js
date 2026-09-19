/* ══════════════════════════════════════════════════════════════════
   Tanot — ค่าเงิน & วัตถุดิบ (การ์ดหลายสินทรัพย์ + กราฟแท่งเทียนสลับ)
   • ราคาสินค้าโภคภัณฑ์/ค่าเงินโลก ดึงจาก Yahoo Finance ผ่าน CORS-proxy chain
     (pattern เดียวกับ invest-gold.js/invest-thai-stock.js — clone-and-adapt)
   • คู่ค่าเงินที่ Yahoo ไม่มี ticker ตรง (เยน/ยูโร/หยวน เทียบบาท) คำนวณ cross
     จากคู่ USD 2 ตัวที่มี ticker จริง (ไม่ใช่ตัวเลขที่เดาขึ้นเอง)
   • ทองคำแท่ง/รูปพรรณไทย ใช้ thai-gold-api เดิม (community, MIT) เหมือนหน้าทองคำ
   • สินค้าบางตัวที่เว็บอ้างอิงมี (ถ่านหิน/ค่าระวางเรือ/ยางพารา/ปาล์ม/มันสำปะหลัง)
     ไม่มีในรายการนี้ เพราะยังไม่พบ ticker สาธารณะฟรีที่มั่นใจได้ — ไม่ใส่เลขปลอม
   หมายเหตุ: ตัวช่วยดูภาพรวมราคา ไม่ใช่คำแนะนำการลงทุน
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  /* ══════ ระบบสองภาษา (ไทย/อังกฤษ) — ตามธรรมเนียมเดียวกับ invest-gold.js ══════ */
  var UI_LANG_KEY = 'ome:lang';
  function getUILang() { try { return localStorage.getItem(UI_LANG_KEY) === 'en' ? 'en' : 'th'; } catch (e) { return 'th'; } }
  var I18N = {
    th: {
      navInvest: 'การลงทุน', pageTitle: 'ค่าเงิน & วัตถุดิบ',
      srcBadgeEod: 'ข้อมูล EOD (วันก่อนหน้า)', loadingDefault: 'กำลังโหลด…',
      ohlcOpen: 'เปิด', ohlcHigh: 'สูง', ohlcLow: 'ต่ำ', ohlcClose: 'ปิด', ohlcChg: 'เปลี่ยนแปลง',
      tf1m: '1เดือน', tf3m: '3เดือน', tf6m: '6เดือน', tf1y: '1ปี',
      chartCapUp: 'แท่งขึ้น', chartCapDown: 'แท่งลง', chartCapTap: 'แตะบนกราฟเพื่อดูราคาแต่ละวัน',
      histTitleDefault: 'ข้อมูลราคาย้อนหลัง',
      histTitleWithAsset: 'ข้อมูลราคา {label} — ล่าสุด {n} วัน',
      histThDate: 'วันที่', histThOpen: 'เปิด', histThHigh: 'สูง', histThLow: 'ต่ำ', histThClose: 'ปิด', histThChg: 'เปลี่ยนแปลง',
      fetchFailShort: 'ดึงไม่ได้',
      goldNoHistEmpty: 'ราคาทองไทยไม่มีข้อมูลย้อนหลังจากแหล่งฟรี',
      goldNoHistTitle: 'ราคาทองไทยไม่มีข้อมูลย้อนหลังจากแหล่งฟรี',
      goldLiveToday: 'ราคาสดวันนี้', goldStale: 'ดึงสดไม่ได้ — ใช้ราคาที่บันทึกไว้ล่าสุด', goldFail: 'ดึงราคาทองไทยไม่ได้ตอนนี้',
      loadingChart: 'กำลังโหลดกราฟ…',
      seriesReal: 'ราคาจาก Yahoo Finance', seriesStale: 'ดึงสดไม่ได้ — ใช้ข้อมูลที่บันทึกไว้ล่าสุด',
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
      aiSumTitle: 'สรุปด้วย AI', aiSumBtn: 'สรุปให้หน่อย',
      iosNotSupported: 'ฟีเจอร์นี้ (AI รันในเครื่อง) ยังไม่รองรับ iPhone/iPad ตอนนี้ — หน่วยความจำต่อแท็บของ Safari/iOS จำกัดเกินกว่าจะรันโมเดลได้อย่างเสถียร ลองใช้งานจากคอมพิวเตอร์แทนได้ครับ',
      needStockData: 'ยังไม่มีข้อมูลราคาให้สรุป — รอข้อมูลราคาโหลดก่อนนะครับ',
      summarizing: 'กำลังสรุป… (ครั้งแรกอาจต้องโหลดโมเดล AI ~350MB ก่อน)', loadingModel: 'กำลังโหลดโมเดล (ครั้งแรกเท่านั้น) {file} {pct}',
      summarizeFail: 'สรุปไม่สำเร็จ ลองอีกครั้ง', summarizeFailWith: 'สรุปไม่สำเร็จ: {msg}', unknownReason: 'ไม่ทราบสาเหตุ',
      memErrorMsg: 'โหลดโมเดล AI ไม่สำเร็จ เพราะหน่วยความจำที่เบราว์เซอร์เหลือให้ใช้ไม่พอ (มักเกิดถ้าเปิดแท็บ/โปรแกรมอื่นพร้อมกันเยอะ) ลองปิดแท็บ/โปรแกรมอื่นแล้วกดสรุปใหม่อีกครั้ง',
      diskErrorMsg: 'บันทึกไฟล์โมเดล AI ไม่สำเร็จ เพราะพื้นที่จัดเก็บของเบราว์เซอร์สำหรับเว็บไซต์นี้เต็ม (คนละเรื่องกับโปรแกรม/แท็บอื่นที่เปิดอยู่) ลองล้างข้อมูลเว็บไซต์นี้ในเบราว์เซอร์ หรือเพิ่มพื้นที่ว่างในดิสก์แล้วลองใหม่',
      summarizeCached: 'ผลสรุปนี้มีคนคำนวณไว้แล้ววันนี้ (โหลดจากแคช ไม่ต้องรันโมเดลในเครื่อง)',
      ctxAsset: 'สินทรัพย์: {label} (หน่วย {unit})', ctxLatestPrice: 'ราคาล่าสุด: {v} {unit}', ctxVerdict: 'สัญญาณไฟจราจรที่คำนวณแล้ว: {v} ({why})',
      ctxPros: 'ปัจจัยหนุนที่ตรวจพบ: {v}', ctxCons: 'ปัจจัยเสี่ยงที่ตรวจพบ: {v}',
      ctxRsi: 'RSI (14 วัน): {v}', ctxRsiHigh: ' (สูง/ร้อนแรง)', ctxRsiLow: ' (ต่ำ/แรงขายเริ่มคลาย)', ctxRsiMid: ' (กลางๆ)',
      ctxMacd: 'MACD histogram: {v}', ctxMacdPos: ' (เป็นบวก)', ctxMacdNeg: ' (เป็นลบ)',
      ctxEma: 'เส้นเฉลี่ย 20 วัน: {e20}, เส้นเฉลี่ย 50 วัน: {e50}', ctxEmaUp: ' (ราคาอยู่เหนือเส้นเฉลี่ย — แนวโน้มขึ้น)', ctxEmaDn: ' (ราคาอยู่ใต้เส้นเฉลี่ย — แนวโน้มลง/พักตัว)',
      ctxSupport: 'แนวรับล่าสุด: {v}', ctxResistance: 'แนวต้านล่าสุด: {v}',
      ctxAdx: 'ความแรงแนวโน้ม (ADX): {v}', ctxAdxStrong: ' (แข็งแรง)', ctxAdxWeak: ' (อ่อน)',
      rcTitle: 'ถ้าจะซื้อ ควรใส่เงินเท่าไร ตั้งขายที่ไหน', rcUnitNote: 'กรอกราคาซื้อ/ราคาตัดขาดทุนเป็นหน่วยเดียวกับราคาที่แสดงด้านบน ({unit})',
      rcCapitalLabel: 'เงินลงทุนทั้งหมด', rcCapitalPh: 'เช่น 100000',
      rcRiskPctLabel: 'ยอมเสี่ยงต่อครั้ง', rcUnitPctPortfolio: '(% ของพอร์ต)',
      rcEntryLabel: 'ราคาซื้อ', rcEntryPh: '= ราคาปัจจุบันของสินทรัพย์ที่เลือก',
      rcStopLabel: 'ราคาตัดขาดทุน', rcStopPh: 'แนะนำอัตโนมัติ',
      rcCalcBtn: 'คำนวณ',
      rcErrNeedEntry: 'กรอกราคาซื้อ (หรือรอราคาปัจจุบันโหลด) ก่อน',
      rcErrStop: 'ราคาตัดขาดทุนต้องต่ำกว่าราคาซื้อ',
      rcCapLimitedNote: 'จำกัดจำนวนตามเงินที่มี (ทุนไม่พอซื้อเท่าที่ความเสี่ยงอนุญาต)',
      rcQtyLine: 'ควรซื้อได้ประมาณ <b>{qty} หน่วย</b> ใช้เงิน ≈ <b>{cost}</b>',
      rcKvIfWrong: 'ถ้าผิดทาง (แตะ Stop) เสียไม่เกิน', rcKvStop: 'ราคาตัดขาดทุน (Stop)',
      rcKvRr: 'ความคุ้ม (กำไรคาดหวัง : ความเสี่ยง) ถึงแนวต้าน',
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
      navInvest: 'Investing', pageTitle: 'FX & Commodities',
      srcBadgeEod: 'EOD data (previous day)', loadingDefault: 'Loading…',
      ohlcOpen: 'Open', ohlcHigh: 'High', ohlcLow: 'Low', ohlcClose: 'Close', ohlcChg: 'Change',
      tf1m: '1M', tf3m: '3M', tf6m: '6M', tf1y: '1Y',
      chartCapUp: 'Up candle', chartCapDown: 'Down candle', chartCapTap: 'Tap the chart to see each day’s price',
      histTitleDefault: 'Price history',
      histTitleWithAsset: 'Price history for {label} — last {n} days',
      histThDate: 'Date', histThOpen: 'Open', histThHigh: 'High', histThLow: 'Low', histThClose: 'Close', histThChg: 'Change',
      fetchFailShort: 'Unavailable',
      goldNoHistEmpty: 'No free historical data for Thai gold price',
      goldNoHistTitle: 'No free historical data for Thai gold price',
      goldLiveToday: "Today's live price", goldStale: 'Live fetch failed — using last saved price', goldFail: "Couldn't fetch Thai gold price right now",
      loadingChart: 'Loading chart…',
      seriesReal: 'Price from Yahoo Finance', seriesStale: 'Live fetch failed — using last saved data',
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
      aiSumTitle: 'AI Summary', aiSumBtn: 'Summarize It',
      iosNotSupported: 'This feature (on-device AI) isn’t supported on iPhone/iPad yet — Safari/iOS per-tab memory is too limited to run the model reliably. Try from a computer instead',
      needStockData: 'No price data to summarize yet — wait for the price data to load first',
      summarizing: 'Summarizing… (first time may need to download the ~350MB AI model)', loadingModel: 'Loading model (first time only) {file} {pct}',
      summarizeFail: 'Summary failed, try again', summarizeFailWith: 'Summary failed: {msg}', unknownReason: 'unknown reason',
      memErrorMsg: 'Failed to load the AI model because the browser doesn’t have enough free memory (usually from having many tabs/programs open at once). Try closing other tabs/programs and summarizing again',
      diskErrorMsg: 'Failed to save the AI model file because this site’s browser storage is full (unrelated to other open tabs/programs). Try clearing this site’s data in your browser, or free up disk space, then try again',
      summarizeCached: 'Someone already summarized this today (loaded from cache — no local model run needed)',
      ctxAsset: 'Asset: {label} (unit: {unit})', ctxLatestPrice: 'Latest price: {v} {unit}', ctxVerdict: 'Computed signal: {v} ({why})',
      ctxPros: 'Detected tailwinds: {v}', ctxCons: 'Detected risks: {v}',
      ctxRsi: 'RSI (14-day): {v}', ctxRsiHigh: ' (high/overheated)', ctxRsiLow: ' (low/selling pressure easing)', ctxRsiMid: ' (neutral)',
      ctxMacd: 'MACD histogram: {v}', ctxMacdPos: ' (positive)', ctxMacdNeg: ' (negative)',
      ctxEma: '20-day MA: {e20}, 50-day MA: {e50}', ctxEmaUp: ' (price above the MAs — uptrend)', ctxEmaDn: ' (price below the MAs — downtrend/consolidation)',
      ctxSupport: 'Latest support: {v}', ctxResistance: 'Latest resistance: {v}',
      ctxAdx: 'Trend strength (ADX): {v}', ctxAdxStrong: ' (strong)', ctxAdxWeak: ' (weak)',
      rcTitle: 'If you buy, how much should you put in, and where should you sell', rcUnitNote: 'Enter the purchase/stop-loss price in the same unit shown above ({unit})',
      rcCapitalLabel: 'Total capital', rcCapitalPh: 'e.g. 100000',
      rcRiskPctLabel: 'Risk tolerance per purchase', rcUnitPctPortfolio: '(% of portfolio)',
      rcEntryLabel: 'Purchase price', rcEntryPh: "= this asset's current price",
      rcStopLabel: 'Stop-loss price', rcStopPh: 'Auto-suggested',
      rcCalcBtn: 'Calculate',
      rcErrNeedEntry: 'Enter the purchase price first (or wait for the current price to load)',
      rcErrStop: 'The stop-loss price must be below the purchase price',
      rcCapLimitedNote: 'Limited by available funds (capital is not enough to buy the full amount the risk setting would allow)',
      rcQtyLine: 'You could buy about <b>{qty} unit(s)</b> using ≈ <b>{cost}</b>',
      rcKvIfWrong: 'If wrong (hits Stop), you lose no more than', rcKvStop: 'Stop-loss price (Stop)',
      rcKvRr: 'Reward:risk to resistance',
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
      chkLeverageUnknown: "Confirm first that you understand the leverage/margin risk of the instrument (press the button above)",
      checklistFail: 'Not ready to buy yet — {n} item(s) failed; fix them all before buying',
      checklistUnknown: 'Not enough information to fully assess — press "Calculate" above and answer the questions first',
      checklistGo: 'Ready to buy per plan — passed every item (still no profit guarantee — follow the plan and always cut losses)'
    }
  };
  function t(key, vars) {
    var s = (I18N[getUILang()] || I18N.th)[key];
    if (s == null) s = (I18N.th[key] != null ? I18N.th[key] : key);
    if (vars) { for (var k in vars) { s = s.split('{' + k + '}').join(vars[k]); } }
    return s;
  }
  function applyStaticI18n() {
    [].forEach.call(document.querySelectorAll('[data-i18n]'), function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    [].forEach.call(document.querySelectorAll('[data-i18n-html]'), function (el) { el.innerHTML = t(el.getAttribute('data-i18n-html')); });
    [].forEach.call(document.querySelectorAll('[data-i18n-placeholder]'), function (el) { el.placeholder = t(el.getAttribute('data-i18n-placeholder')); });
  }

  /* หน้านี้เปิดเป็นป๊อปอัพ (iframe) จาก invest.html ได้ด้วย ?embed=1 — ซ่อน breadcrumb ให้ดูเป็นกล่องเดียวกัน */
  if (new URLSearchParams(location.search).get('embed')) document.body.classList.add('embedded');

  /* ── รายการสินทรัพย์ ──────────────────────────────────────────
     kind: 'yahoo' = ticker เดี่ยวดึงตรง, 'cross' = คำนวณจาก 2 ticker,
           'thaigold' = ราคาทองไทย (thai-gold-api, ไม่มีกราฟย้อนหลัง)
     group: ใช้จัดกลุ่มแถวปุ่มเลือกสินทรัพย์ (pillRow) กันเป็นแถวยาวปนกันไม่มีหมวด
     labelKey/unitKey: คีย์ i18n สำหรับชื่อ/หน่วย — ใช้ assetLabel()/assetUnit() แปลตามภาษาปัจจุบัน */
  var GROUPS = [
    { key: 'fx', labelKey: 'groupFx' },
    { key: 'metal', labelKey: 'groupMetal' },
    { key: 'energy', labelKey: 'groupEnergy' },
    { key: 'agri', labelKey: 'groupAgri' }
  ];
  var ASSETS = [
    { key: 'usdthb', labelKey: 'labelUsdthb', icon: '', kind: 'yahoo', sym: 'THB=X', unitKey: 'unitUsdthb', dp: 3, group: 'fx' },
    { key: 'gc', labelKey: 'labelGc', icon: '', kind: 'yahoo', sym: 'GC=F', unitKey: 'unitGc', dp: 1, group: 'metal' },
    { key: 'goldbar', labelKey: 'labelGoldbar', icon: '▬', kind: 'thaigold', field: 'bar', unitKey: 'unitGoldw', dp: 0, group: 'metal' },
    { key: 'goldjew', labelKey: 'labelGoldjew', icon: '', kind: 'thaigold', field: 'jewelry', unitKey: 'unitGoldw', dp: 0, group: 'metal' },
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
  function assetLabel(a) { return t(a.labelKey); }
  function assetUnit(a) { return t(a.unitKey); }
  function groupLabel(g) { return t(g.labelKey); }
  /* สินทรัพย์หลักที่โชว์ราคา+% ในแถวสถิติด้านบน (แยกจากแถวปุ่มเลือกที่มีครบทุกตัว — เหมือนแถวบนสุดของเว็บอ้างอิง) */
  var STAT_KEYS = ['usdthb', 'gc', 'goldbar', 'goldjew', 'wti'];

  var LAST_KEY = 'tanot:invest:comm:lastKey';
  var curKey = null, curTF = 63, curType = 'candle';
  var chart = null, seriesObj = null, LWC = null, fullData = null;
  var lastAnalysis = null;
  var cAnswers = { noLeverage: null };

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }
  function fmt(n, d) { d = d == null ? 2 : d; return isFinite(n) ? n.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'; }

  /* ── fetch พื้นฐาน (proxy chain — เหมือน invest-gold.js) ───────── */
  function fetchOne(url, timeoutMs, parser) {
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var to = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs || 8000) : null;
    return fetch(url, ctrl ? { signal: ctrl.signal } : undefined)
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.text(); })
      .then(function (t) { if (to) clearTimeout(to); return parser(t); });
  }
  function proxyTries(base, offset) {
    var enc = encodeURIComponent(base);
    var tries = [
      { url: 'https://tanot-cors-proxy.tanot713.workers.dev/?url=' + enc },
      { url: 'https://api.allorigins.win/raw?url=' + enc },
      { url: 'https://api.codetabs.com/v1/proxy/?quest=' + enc },
      { url: 'https://cors.eu.org/' + base },
      { url: 'https://test.cors.workers.dev/?' + base },
      { url: 'https://api.cors.lol/?url=' + enc },
      { url: base }
    ];
    offset = ((offset || 0) % tries.length + tries.length) % tries.length;
    return tries.slice(offset).concat(tries.slice(0, offset));
  }
  function parseQuoteLite(t) {
    var j = JSON.parse(t), res = j && j.chart && j.chart.result && j.chart.result[0];
    var meta = res && res.meta;
    if (!meta || !isFinite(meta.regularMarketPrice)) throw new Error('no meta');
    /* เก็บราคาปิดของ 5 วันล่าสุดไว้ด้วย (มีอยู่แล้วในการตอบกลับนี้ ไม่ต้องยิง fetch เพิ่ม)
       ใช้วาดกราฟเส้นจิ๋ว (sparkline) ในการ์ดสถิติ — เห็นแนวโน้มเร็วๆ แบบแอปการเงินทั่วไป */
    var q = res.indicators && res.indicators.quote && res.indicators.quote[0], spark = [];
    if (q && q.close) spark = q.close.filter(function (v) { return v != null; });
    return { price: meta.regularMarketPrice, prevClose: meta.previousClose, spark: spark };
  }
  function sparkSvg(vals, up) {
    if (!vals || vals.length < 2) return '';
    var w = 100, h = 28, min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    var range = Math.max(1e-9, max - min), i, pts = [];
    for (i = 0; i < vals.length; i++) {
      var x = i / (vals.length - 1) * w, y = h - (vals[i] - min) / range * (h - 4) - 2;
      pts.push(x.toFixed(1) + ',' + y.toFixed(1));
    }
    var color = up ? '#17B26A' : '#E5484D';
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none"><polyline points="' + pts.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  }
  function parseYahooSeries(t) {
    var j = JSON.parse(t), res = j && j.chart && j.chart.result && j.chart.result[0];
    var ts = res && res.timestamp, q = res && res.indicators && res.indicators.quote && res.indicators.quote[0];
    if (!ts || !q || !q.close) throw new Error('no data');
    var times = [], opens = [], highs = [], lows = [], closes = [], i;
    for (i = 0; i < ts.length; i++) {
      if (q.close[i] == null) continue;
      times.push(new Date(ts[i] * 1000).toISOString().slice(0, 10));
      opens.push(q.open[i] != null ? q.open[i] : q.close[i]);
      highs.push(q.high[i] != null ? q.high[i] : q.close[i]);
      lows.push(q.low[i] != null ? q.low[i] : q.close[i]);
      closes.push(q.close[i]);
    }
    if (closes.length < 5) throw new Error('short');
    return { times: times, opens: opens, highs: highs, lows: lows, closes: closes };
  }

  /* quote-lite (สำหรับการ์ดสรุป — เบา, range สั้น) — dedupe ต่อ symbol กันยิง proxy ซ้ำ */
  var quoteCacheMem = {}, quotePromises = {}, seqCounter = 0;
  function quoteCacheKey(sym) { return 'tanot:invest:cache:comm:q:' + sym; }
  function saveQuoteCache(sym, q) { try { localStorage.setItem(quoteCacheKey(sym), JSON.stringify({ ts: Date.now(), price: q.price, prevClose: q.prevClose, spark: q.spark })); } catch (e) {} }
  function loadQuoteCache(sym) { try { var o = JSON.parse(localStorage.getItem(quoteCacheKey(sym))); return (o && isFinite(o.price)) ? o : null; } catch (e) { return null; } }
  function getQuote(sym) {
    if (quoteCacheMem[sym]) return Promise.resolve(quoteCacheMem[sym]);
    if (quotePromises[sym]) return quotePromises[sym];
    var base = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?range=5d&interval=1d';
    var tries = proxyTries(base, seqCounter++), i = 0;
    function next() {
      if (i >= tries.length) return Promise.reject(new Error('fail'));
      return fetchOne(tries[i++].url, 7000, parseQuoteLite).catch(next);
    }
    var p = next().then(function (q) {
      quoteCacheMem[sym] = q; saveQuoteCache(sym, q); return q;
    }, function (e) {
      var c = loadQuoteCache(sym);
      if (c) { quoteCacheMem[sym] = c; return c; }
      throw e;
    });
    quotePromises[sym] = p;
    return p;
  }

  /* series เต็ม 1 ปี (สำหรับกราฟแท่งเทียน) */
  var seriesCacheMem = {}, seriesPromises = {};
  function seriesCacheKey(sym) { return 'tanot:invest:cache:comm:s:' + sym; }
  function saveSeriesCache(sym, s) { try { localStorage.setItem(seriesCacheKey(sym), JSON.stringify({ ts: Date.now(), t: s.times, o: s.opens, h: s.highs, l: s.lows, c: s.closes })); } catch (e) {} }
  function loadSeriesCache(sym) {
    try {
      var o = JSON.parse(localStorage.getItem(seriesCacheKey(sym)));
      if (!o || !o.c || o.c.length < 5) return null;
      return { times: o.t, opens: o.o, highs: o.h, lows: o.l, closes: o.c, cachedAt: o.ts };
    } catch (e) { return null; }
  }
  function getSeries(sym) {
    if (seriesCacheMem[sym]) return Promise.resolve(seriesCacheMem[sym]);
    if (seriesPromises[sym]) return seriesPromises[sym];
    var base = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?range=1y&interval=1d';
    var tries = proxyTries(base, seqCounter++), i = 0, best = null;
    function next() {
      if (i >= tries.length) return best ? Promise.resolve(best) : Promise.reject(new Error('all failed'));
      return fetchOne(tries[i++].url, 8000, parseYahooSeries).then(function (s) {
        if (!best || s.closes.length > best.closes.length) best = s;
        if (best.closes.length >= 60) return best;
        return next();
      }, next);
    }
    var p = next().then(function (s) {
      seriesCacheMem[sym] = { series: s, stale: false }; saveSeriesCache(sym, s);
      return seriesCacheMem[sym];
    }, function (e) {
      var c = loadSeriesCache(sym);
      if (c) { var r = { series: c, stale: true, cachedAt: c.cachedAt }; seriesCacheMem[sym] = r; return r; }
      throw e;
    });
    seriesPromises[sym] = p;
    return p;
  }

  /* ── ราคาทองไทย (thai-gold-api — ใช้ตัวเดียวกันทั้งบาร์/รูปพรรณ) ── */
  var thaiGoldPromise = null;
  function parseGoldTH(t) {
    var j = JSON.parse(t), r = j && j.response;
    if (!r || !r.price || !r.price.gold_bar || !r.price.gold) throw new Error('no data');
    function n(s) { return parseFloat(String(s).replace(/,/g, '')); }
    var bar = r.price.gold_bar, jew = r.price.gold;
    var out = { bar: n(bar.sell), barBuy: n(bar.buy), jewelry: n(jew.sell), jewelryBuy: n(jew.buy), updateDate: r.update_date };
    if (![out.bar, out.barBuy, out.jewelry, out.jewelryBuy].every(isFinite)) throw new Error('bad numbers');
    return out;
  }
  function thaiGoldCacheKey() { return 'tanot:invest:cache:comm:thaigold'; }
  function saveThaiGoldCache(o) { try { var c = {}; for (var k in o) c[k] = o[k]; c.ts = Date.now(); localStorage.setItem(thaiGoldCacheKey(), JSON.stringify(c)); } catch (e) {} }
  function loadThaiGoldCache() { try { var o = JSON.parse(localStorage.getItem(thaiGoldCacheKey())); return (o && isFinite(o.bar)) ? o : null; } catch (e) { return null; } }
  function getThaiGold() {
    if (thaiGoldPromise) return thaiGoldPromise;
    var base = 'https://api.chnwt.dev/thai-gold-api/latest', tries = proxyTries(base, 0).slice();
    /* ลองตรงก่อนเหมือนหน้าทองคำ (API นี้เปิด CORS เอง) แล้วค่อยไล่ proxy */
    tries.unshift({ url: base });
    var i = 0;
    function next() {
      if (i >= tries.length) return Promise.reject(new Error('all failed'));
      return fetchOne(tries[i++].url, 7000, parseGoldTH).catch(next);
    }
    thaiGoldPromise = next().then(function (o) {
      saveThaiGoldCache(o); return { data: o, stale: false };
    }, function (e) {
      var c = loadThaiGoldCache();
      if (c) return { data: c, stale: true, cachedAt: c.ts };
      throw e;
    });
    return thaiGoldPromise;
  }

  /* ── การ์ดสรุป (เฉพาะสินทรัพย์ใน STAT_KEYS เท่านั้นที่มีการ์ดโชว์ราคา) ── */
  function cardEl(a) {
    return document.querySelector('.stat-card[data-key="' + a.key + '"]');
  }
  function writeCard(a, price, chgPct, spark) {
    var el = cardEl(a); if (!el) return;
    var prEl = el.querySelector('.pr'), chgEl = el.querySelector('.chg'), sparkEl = el.querySelector('.spark');
    if (!isFinite(price)) { prEl.textContent = t('fetchFailShort'); prEl.className = 'pr na'; chgEl.textContent = ''; if (sparkEl) sparkEl.innerHTML = ''; return; }
    prEl.textContent = fmt(price, a.dp); prEl.className = 'pr';
    if (isFinite(chgPct)) {
      chgEl.textContent = (chgPct >= 0 ? '▲' : '▼') + fmt(Math.abs(chgPct), 2) + '%';
      chgEl.className = 'chg ' + (chgPct > 0 ? 'up' : chgPct < 0 ? 'dn' : 'flat');
    } else { chgEl.textContent = ''; }
    if (sparkEl) sparkEl.innerHTML = sparkSvg(spark, !(isFinite(chgPct) && chgPct < 0));
  }
  function loadCardQuote(a) {
    if (a.kind === 'yahoo') {
      getQuote(a.sym).then(function (q) {
        var pct = isFinite(q.prevClose) && q.prevClose ? (q.price / q.prevClose - 1) * 100 : NaN;
        writeCard(a, q.price, pct, q.spark);
      }, function () { writeCard(a, NaN, NaN); });
    } else if (a.kind === 'cross') {
      Promise.all([getQuote(a.a), getQuote(a.b)]).then(function (r) {
        var qa = r[0], qb = r[1];
        var now = crossVal(a, qa.price, qb.price);
        var prevA = isFinite(qa.prevClose) ? qa.prevClose : qa.price, prevB = isFinite(qb.prevClose) ? qb.prevClose : qb.price;
        var prev = crossVal(a, prevA, prevB);
        var pct = isFinite(prev) && prev ? (now / prev - 1) * 100 : NaN;
        writeCard(a, now, pct);
      }, function () { writeCard(a, NaN, NaN); });
    } else if (a.kind === 'thaigold') {
      getThaiGold().then(function (r) { writeCard(a, r.data[a.field], NaN); }, function () { writeCard(a, NaN, NaN); });
    }
  }
  function crossVal(a, va, vb) {
    var r = a.op === 'mul' ? va * vb : va / vb;
    return r * (a.mul || 1);
  }

  function buildGrid() {
    /* แถวสถิติ: การ์ดใหญ่ ราคา+% เฉพาะสินทรัพย์หลัก 5 ตัว (เหมือนแถวบนสุดของเว็บอ้างอิง) */
    var statHtml = '';
    STAT_KEYS.forEach(function (k) {
      var a = byKey[k];
      statHtml += '<button type="button" class="stat-card" data-key="' + a.key + '">' +
        '<span class="ic">' + a.icon + '</span>' +
        '<span class="nm">' + assetLabel(a) + '</span>' +
        '<span class="pr na">' + t('loadingDefault') + '</span>' +
        '<span class="chg"></span>' +
        '<span class="spark"></span></button>';
    });
    $('statRow').innerHTML = statHtml;

    /* แถวปุ่มเลือก: pill ครบทุกสินทรัพย์ (ไม่โชว์ราคา) — ตัวเลือกจริงสำหรับสลับกราฟด้านล่าง
       จัดเป็นกลุ่มตาม GROUPS กันเป็นแถวยาวปนกันไม่มีหมวดหมู่ */
    var pillHtml = '';
    GROUPS.forEach(function (g) {
      var items = ASSETS.filter(function (a) { return a.group === g.key; });
      if (!items.length) return;
      pillHtml += '<div class="pill-group"><span class="pill-group-lbl">' + groupLabel(g) + '</span><div class="pill-group-row">' +
        items.map(function (a) { return '<button type="button" class="pill" data-key="' + a.key + '"><span class="ic">' + a.icon + '</span>' + assetLabel(a) + '</button>'; }).join('') +
        '</div></div>';
    });
    $('pillRow').innerHTML = pillHtml;

    [].forEach.call(document.querySelectorAll('.stat-card, .pill'), function (btn) {
      btn.addEventListener('click', function () { selectAsset(btn.getAttribute('data-key')); });
    });
    /* ทยอยยิงเฉพาะ 5 ตัวในแถวสถิติ (ตัวอื่นดึงตอนกดเลือกจริงในแถวปุ่ม) กัน proxy โดน rate-limit */
    STAT_KEYS.forEach(function (k, i) { setTimeout(function () { loadCardQuote(byKey[k]); }, i * 180); });
  }

  /* ── กราฟแท่งเทียน (lightweight-charts — เหมือน invest-thai-stock.js) ── */
  function themeColors() {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return dark ? { bg: '#1B2030', text: '#C2CBDD', grid: '#2A3040', border: '#2A3040' }
                : { bg: '#FFFFFF', text: '#4A5568', grid: '#EEF1F7', border: '#E4E9F2' };
  }
  function chartWidth(el) { return Math.max(240, (el && (el.clientWidth || el.offsetWidth)) || 320); }
  function baseOpts(w, h) {
    var c = themeColors();
    return {
      width: w, height: h,
      localization: { locale: 'en-US' },
      layout: { background: { color: c.bg }, textColor: c.text, fontFamily: "'Prompt',system-ui,sans-serif" },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      rightPriceScale: { borderColor: c.border },
      timeScale: { borderColor: c.border, rightOffset: 3, fixLeftEdge: true }
    };
  }
  var themeObs = null, resizeWired = false;
  function setupThemeObserver() {
    if (themeObs) return;
    themeObs = new MutationObserver(function () {
      if (!chart) return;
      var c = themeColors();
      chart.applyOptions({ layout: { background: { color: c.bg }, textColor: c.text }, grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } }, rightPriceScale: { borderColor: c.border }, timeScale: { borderColor: c.border } });
    });
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
  function setupResize() {
    if (resizeWired) return; resizeWired = true;
    window.addEventListener('resize', reflow);
    if ('ResizeObserver' in window) { try { new ResizeObserver(reflow).observe($('lwChart')); } catch (e) {} }
  }
  function reflow() {
    var el = $('lwChart');
    if (chart && el) { try { chart.applyOptions({ width: chartWidth(el) }); chart.timeScale().fitContent(); } catch (e) {} }
  }
  function ohlcAt(s, i) { return { time: s.times[i], open: s.opens[i], high: s.highs[i], low: s.lows[i], close: s.closes[i] }; }
  function toCandleData(s) { var out = [], i; for (i = 0; i < s.times.length; i++) out.push(ohlcAt(s, i)); return out; }
  function toLineData(s) { var out = [], i; for (i = 0; i < s.times.length; i++) out.push({ time: s.times[i], value: s.closes[i] }); return out; }

  function buildChart(s) {
    if (!window.LightweightCharts) return false;
    LWC = window.LightweightCharts;
    if (chart) { try { chart.remove(); } catch (e) {} chart = null; seriesObj = null; }
    var el = $('lwChart'); el.innerHTML = '';
    $('chartEmpty').style.display = 'none'; $('chartCap').style.display = 'flex'; el.style.display = 'block';
    chart = LWC.createChart(el, baseOpts(chartWidth(el), 260));
    if (curType === 'candle') {
      seriesObj = chart.addCandlestickSeries({ upColor: '#26a69a', downColor: '#ef5350', borderVisible: false, wickUpColor: '#26a69a', wickDownColor: '#ef5350' });
    } else {
      seriesObj = chart.addLineSeries({ color: '#3B9BEA', lineWidth: 2 });
    }
    applyTF(curTF);
    setupThemeObserver(); setupResize();
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
    [].forEach.call(document.querySelectorAll('#tfGroup .tf'), function (b) { b.classList.toggle('on', +b.getAttribute('data-tf') === n); });
  }
  function updateOhlcRow(sub) {
    var n = sub.closes.length; if (!n) return;
    var last = ohlcAt(sub, n - 1);
    var prevClose = n >= 2 ? sub.closes[n - 2] : last.open;
    var chg = last.close - prevClose, pct = prevClose ? chg / prevClose * 100 : NaN;
    var dp = byKey[curKey] ? byKey[curKey].dp : 2;
    $('oOpen').textContent = fmt(last.open, dp);
    $('oHigh').textContent = fmt(last.high, dp);
    $('oLow').textContent = fmt(last.low, dp);
    $('oClose').textContent = fmt(last.close, dp);
    var chgEl = $('oChg');
    chgEl.textContent = (chg >= 0 ? '+' : '') + fmt(chg, dp) + (isFinite(pct) ? ' (' + (pct >= 0 ? '+' : '') + fmt(pct, 2) + '%)' : '');
    chgEl.className = 'v ' + (chg > 0 ? 'up' : chg < 0 ? 'dn' : '');
    $('ohlcRow').style.display = 'grid';
  }

  /* ── ตารางราคาย้อนหลัง (ล่าสุด 30 วัน — เหมือนตารางท้ายหน้าของเว็บอ้างอิง) ── */
  var HIST_DAYS = 30;
  function renderHistTable(s, a) {
    var titleEl = $('histTitle'); if (titleEl) titleEl.textContent = t('histTitleWithAsset', { label: assetLabel(a), n: Math.min(HIST_DAYS, s.times.length) });
    var tbl = $('histTable'); if (!tbl) return;
    var n = s.times.length;
    if (!n) { tbl.innerHTML = ''; return; }
    var start = Math.max(0, n - HIST_DAYS);
    var rows = '';
    for (var i = n - 1; i >= start; i--) {
      var bar = ohlcAt(s, i);
      var prevClose = i > 0 ? s.closes[i - 1] : bar.open;
      var chg = bar.close - prevClose, pct = prevClose ? chg / prevClose * 100 : NaN;
      var dateTxt = new Date(bar.time).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
      rows += '<tr><td>' + dateTxt + '</td><td>' + fmt(bar.open, a.dp) + '</td>' +
        '<td class="hi">' + fmt(bar.high, a.dp) + '</td><td class="lo">' + fmt(bar.low, a.dp) + '</td>' +
        '<td>' + fmt(bar.close, a.dp) + '</td>' +
        '<td class="chg ' + (chg > 0 ? 'up' : chg < 0 ? 'dn' : '') + '">' + (chg >= 0 ? '+' : '') + fmt(chg, a.dp) + (isFinite(pct) ? ' (' + (pct >= 0 ? '+' : '') + fmt(pct, 2) + '%)' : '') + '</td></tr>';
    }
    tbl.innerHTML = '<thead><tr><th>' + t('histThDate') + '</th><th>' + t('histThOpen') + '</th><th>' + t('histThHigh') + '</th><th>' + t('histThLow') + '</th><th>' + t('histThClose') + '</th><th>' + t('histThChg') + '</th></tr></thead><tbody>' + rows + '</tbody>';
  }

  /* คำนวณ series cross จาก 2 series จริง (จับคู่ตามวันที่ตรงกัน) — ประมาณค่าต่อองค์ประกอบ OHLC
     (ไม่ใช่ tick-by-tick จริง แต่เป็นวิธีที่ใช้ทั่วไปสำหรับกราฟ cross-rate โดยประมาณ) */
  function crossSeries(a, sa, sb) {
    var mapB = {}, i;
    for (i = 0; i < sb.times.length; i++) mapB[sb.times[i]] = ohlcAt(sb, i);
    var times = [], opens = [], highs = [], lows = [], closes = [];
    for (i = 0; i < sa.times.length; i++) {
      var bBar = mapB[sa.times[i]]; if (!bBar) continue;
      var aBar = ohlcAt(sa, i);
      times.push(sa.times[i]);
      opens.push(crossVal(a, aBar.open, bBar.open));
      highs.push(crossVal(a, aBar.high, bBar.high));
      lows.push(crossVal(a, aBar.low, bBar.low));
      closes.push(crossVal(a, aBar.close, bBar.close));
    }
    return { times: times, opens: opens, highs: highs, lows: lows, closes: closes };
  }

  /* ── อินดิเคเตอร์ (สูตรมาตรฐาน — เหมือน invest-gold.js/invest-bitcoin.js เป๊ะ, asset-agnostic) ── */
  function sma(arr, n) {
    if (arr.length < n) return NaN;
    var s = 0; for (var i = arr.length - n; i < arr.length; i++) s += arr[i];
    return s / n;
  }
  function emaSeries(arr, n) {
    if (arr.length < n) return [];
    var k = 2 / (n + 1), out = [], seed = 0, i;
    for (i = 0; i < n; i++) seed += arr[i];
    var prev = seed / n; out[n - 1] = prev;
    for (i = n; i < arr.length; i++) { prev = arr[i] * k + prev * (1 - k); out[i] = prev; }
    return out;
  }
  function emaLast(arr, n) { var e = emaSeries(arr, n); return e.length ? e[e.length - 1] : NaN; }

  function rsi(arr, n) {
    n = n || 14;
    if (arr.length < n + 1) return NaN;
    var gain = 0, loss = 0, i, ch;
    for (i = 1; i <= n; i++) { ch = arr[i] - arr[i - 1]; if (ch >= 0) gain += ch; else loss -= ch; }
    var ag = gain / n, al = loss / n;
    for (i = n + 1; i < arr.length; i++) {
      ch = arr[i] - arr[i - 1];
      ag = (ag * (n - 1) + (ch > 0 ? ch : 0)) / n;
      al = (al * (n - 1) + (ch < 0 ? -ch : 0)) / n;
    }
    if (al === 0) return 100;
    return 100 - 100 / (1 + ag / al);
  }
  function macd(arr) {
    if (arr.length < 26) return null;
    var e12 = emaSeries(arr, 12), e26 = emaSeries(arr, 26), line = [], i;
    for (i = 25; i < arr.length; i++) line.push(e12[i] - e26[i]);
    if (line.length < 9) return { line: line[line.length - 1], signal: NaN, hist: NaN, histPrev: NaN };
    var sig = emaSeries(line, 9), last = line.length - 1;
    var hist = line[last] - sig[last];
    var histPrev = (line.length >= 2 && sig[last - 1] != null) ? line[last - 1] - sig[last - 1] : NaN;
    return { line: line[last], signal: sig[last], hist: hist, histPrev: histPrev };
  }
  function bollinger(arr, n, k) {
    n = n || 20; k = k || 2;
    if (arr.length < n) return null;
    var mid = sma(arr, n), i, sum = 0;
    for (i = arr.length - n; i < arr.length; i++) sum += (arr[i] - mid) * (arr[i] - mid);
    var sd = Math.sqrt(sum / n);
    return { mid: mid, upper: mid + k * sd, lower: mid - k * sd, sd: sd };
  }
  function atr(highs, lows, closes, n) {
    n = n || 14;
    if (closes.length < n + 1) return NaN;
    var trs = [], i;
    for (i = 1; i < closes.length; i++) trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
    var a = 0; for (i = 0; i < n; i++) a += trs[i]; a /= n;
    for (i = n; i < trs.length; i++) a = (a * (n - 1) + trs[i]) / n;
    return a;
  }
  function supRes(highs, lows, look) {
    look = look || 20;
    var hi = -Infinity, lo = Infinity, i, start = Math.max(0, highs.length - 1 - look);
    for (i = start; i < highs.length - 1; i++) { if (highs[i] > hi) hi = highs[i]; if (lows[i] < lo) lo = lows[i]; }
    return { support: isFinite(lo) ? lo : NaN, resistance: isFinite(hi) ? hi : NaN };
  }
  function adx(highs, lows, closes, n) {
    n = n || 14;
    if (closes.length < 2 * n + 1) return NaN;
    var tr = [], pdm = [], ndm = [], i;
    for (i = 1; i < closes.length; i++) {
      var up = highs[i] - highs[i - 1], dn = lows[i - 1] - lows[i];
      pdm.push(up > dn && up > 0 ? up : 0); ndm.push(dn > up && dn > 0 ? dn : 0);
      tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
    }
    function wilder(arr) { var out = [], s = 0, j; for (j = 0; j < n; j++) s += arr[j]; out[n - 1] = s; for (j = n; j < arr.length; j++) { s = s - s / n + arr[j]; out[j] = s; } return out; }
    var trS = wilder(tr), pdmS = wilder(pdm), ndmS = wilder(ndm), dx = [];
    for (i = n - 1; i < tr.length; i++) {
      if (!trS[i]) { dx.push(0); continue; }
      var pdi = 100 * pdmS[i] / trS[i], ndi = 100 * ndmS[i] / trS[i], sum = pdi + ndi;
      dx.push(sum === 0 ? 0 : 100 * Math.abs(pdi - ndi) / sum);
    }
    if (dx.length < n) return NaN;
    var a = 0; for (i = 0; i < n; i++) a += dx[i]; a /= n;
    for (i = n; i < dx.length; i++) a = (a * (n - 1) + dx[i]) / n;
    return a;
  }

  /* ── วิเคราะห์ (มีซีรีส์เต็ม) → ไฟจราจร — เหมือน invest-gold.js เป๊ะ ใช้ได้กับทุกสินทรัพย์ที่มีซีรีส์ OHLC
     (yahoo ตรง + cross ที่คำนวณแล้ว) ยกเว้น thaigold (ไม่มีซีรีส์ย้อนหลัง — โชว์สถานะ "ยังไม่มีข้อมูล" แทน) ── */
  function analyzeSeries(s) {
    var c = s.closes, price = c[c.length - 1];
    var ema20 = emaLast(c, 20), ema50 = emaLast(c, 50), r = rsi(c, 14);
    var mac = macd(c), bb = bollinger(c, 20, 2), at = atr(s.highs, s.lows, c, 14);
    var sr = supRes(s.highs, s.lows, 20);
    var adxV = adx(s.highs, s.lows, c, 14);
    var range = { hi: Math.max.apply(null, c), lo: Math.min.apply(null, c) };
    var posRange = (price - range.lo) / Math.max(1e-9, range.hi - range.lo);
    var posBB = bb ? (price - bb.lower) / Math.max(1e-9, bb.upper - bb.lower) : 0.5;
    var uptrend = isFinite(ema50) ? price >= ema50 : (isFinite(ema20) ? price >= ema20 : true);
    var momUp = mac && isFinite(mac.hist) && isFinite(mac.histPrev) ? mac.hist > mac.histPrev : false;
    var momDn = mac && isFinite(mac.hist) && isFinite(mac.histPrev) ? mac.hist < mac.histPrev : false;

    var score = 0, pros = [], cons = [];
    if (posRange < 0.35) { score += 1; pros.push(t('whyCheapRange')); }
    else if (posRange > 0.75) { score -= 1; cons.push(t('whyExpensiveRange')); }
    if (isFinite(r)) {
      if (r < 38) { score += 1; pros.push(t('whyRsiLow')); }
      else if (r > 70) { score -= 1; cons.push(t('whyRsiHigh')); }
    }
    if (momUp) { score += 1; pros.push(t('whyMomUp')); }
    else if (momDn) { score -= 1; cons.push(t('whyMomDn')); }
    if (uptrend) { score += 1; pros.push(t('whyUptrend')); }
    else { score -= 1; cons.push(t('whyDowntrend')); }
    if (posBB < 0.2) { score += 0.5; pros.push(t('whyBbLow')); }
    else if (posBB > 0.9) { score -= 0.5; cons.push(t('whyBbHigh')); }

    var light, verdict;
    if (score >= 2) { light = 'green'; verdict = t('vInteresting'); }
    else if (score <= -1) { light = 'red'; verdict = t('vCareful'); }
    else { light = 'yellow'; verdict = t('vMid'); }
    var why = (light === 'green' ? pros : light === 'red' ? cons : (pros.concat(cons)))[0] || t('whyNeutral');

    var stopByAtr = isFinite(at) ? price - 1.5 * at : NaN;
    var stopBySup = isFinite(sr.support) ? sr.support * 0.99 : NaN;
    var stop = NaN;
    if (isFinite(stopBySup) && stopBySup < price) stop = stopBySup;
    if (isFinite(stopByAtr) && stopByAtr < price && (!isFinite(stop) || stopByAtr > stop)) stop = stopByAtr;
    if (!isFinite(stop) || stop <= 0) stop = price * 0.95;

    return {
      light: light, verdict: verdict, why: why, pros: pros, cons: cons, score: score,
      price: price, resistance: sr.resistance, uptrend: uptrend, rsi: r, adx: adxV, suggestStop: stop,
      det: { ema20: ema20, ema50: ema50, rsi: r, macdHist: mac ? mac.hist : NaN,
             support: sr.support, resistance: sr.resistance, posRange: posRange, adx: adxV }
    };
  }

  /* ── การ์ด "ไฟจราจร" (ถูก/แพงเทียบแนวโน้ม) — อัปเดตทุกครั้งที่สลับสินทรัพย์ใน selectAsset() ── */
  function showVerdict(a, asset) {
    if (a) lastAnalysis = a;
    if (!a) {
      $('vLight').className = 'light gray';
      $('vBulb').style.background = '#B8C0D4';
      $('vVerdict').textContent = t('gVerdictNoData');
      $('vWhy').textContent = '';
      $('vDetailsBox').style.display = 'none';
      $('aiSumCard').style.display = 'none';
      $('rcUnitNote').textContent = '';
      return;
    }
    var bulbColors = { green: 'var(--ok)', yellow: 'var(--amber)', red: 'var(--err)' };
    $('vLight').className = 'light ' + a.light;
    $('vBulb').style.background = bulbColors[a.light] || '#B8C0D4';
    $('vVerdict').textContent = a.verdict;
    $('vWhy').textContent = a.why;
    if (a.det && isFinite(a.det.rsi)) {
      var d = a.det, dp = asset.dp, rows = [
        [t('detEma20'), fmt(d.ema20, dp)], [t('detEma50'), fmt(d.ema50, dp)],
        [t('detRsi'), fmt(d.rsi, 1)], [t('detMacd'), fmt(d.macdHist, 4)],
        [t('detSupport'), fmt(d.support, dp)], [t('detResistance'), fmt(d.resistance, dp)],
        [t('detAdx'), isFinite(d.adx) ? fmt(d.adx, 0) + (d.adx >= 20 ? t('detAdxStrong') : t('detAdxWeak')) : t('detNoData')]
      ], html = '';
      rows.forEach(function (r) { html += '<div class="k">' + r[0] + '</div><div class="v">' + r[1] + '</div>'; });
      $('vDetKv').innerHTML = html;
      $('vDetailsBox').style.display = 'block';
    } else { $('vDetailsBox').style.display = 'none'; }

    /* การ์ด "สรุปด้วย AI" — โชว์เมื่อมีไฟจราจรจริง รีเซ็ตผลสรุปเก่าทิ้งทุกครั้งที่สลับสินทรัพย์/โหลดข้อมูลใหม่ */
    $('aiSumCard').style.display = 'block';
    $('aiSumOut').style.display = 'none'; $('aiSumOut').textContent = '';
    setAiSumStatus('', '');

    /* บอกหน่วยเงินของราคาซื้อ/ราคาตัดขาดทุนในการ์ดคำนวณความเสี่ยงด้านล่าง ให้ตรงกับหน่วยของสินทรัพย์ที่เลือกอยู่
       (หน้านี้มีหลายสินทรัพย์คนละสกุล/หน่วยกัน ต่างจากหน้าหุ้น/บิตคอยน์ที่มีสกุลเดียวคงที่) */
    $('rcUnitNote').textContent = t('rcUnitNote', { unit: assetUnit(asset) });
  }

  /* ── ถ้าจะซื้อ ควรใส่เงินเท่าไร ตั้งขายที่ไหน — คำนวณตรงๆ ในหน่วยของสินทรัพย์ที่เลือกอยู่
     (ไม่มีปัญหาหน่วยไม่ตรงแบบหน้าทองคำ เพราะ analyzeSeries() ที่นี่วิ่งบนราคาจริงของสินทรัพย์นั้นเอง) ── */
  function riskCalc(o) {
    var capital = o.capital, riskPct = o.riskPct, entry = o.entry, stop = o.stop;
    var perUnit = entry - stop;
    if (!(perUnit > 0)) return { error: t('rcErrStop') };
    var riskBudget = capital * riskPct / 100;
    var qty = riskBudget / perUnit, note = '';
    var cost = qty * entry;
    if (cost > capital) {
      var maxQty = capital / entry;
      if (maxQty > 0) { qty = maxQty; cost = qty * entry; note = t('rcCapLimitedNote'); }
    }
    var rr = (isFinite(o.resistance) && o.resistance > entry) ? (o.resistance - entry) / perUnit : NaN;
    return { qty: qty, cost: cost, riskAmt: qty * perUnit, rr: rr, riskBudget: riskBudget, note: note };
  }
  function doCalc() {
    var asset = byKey[curKey]; if (!asset) return;
    var capital = num($('rcCapital').value), riskPct = num($('rcRiskPct').value);
    var entry = num($('rcEntry').value), stop = num($('rcStop').value);
    var box = $('rcResult');
    box.style.display = 'block';
    if (!isFinite(entry)) {
      entry = (lastAnalysis && isFinite(lastAnalysis.price)) ? lastAnalysis.price : NaN;
      if (isFinite(entry)) $('rcEntry').value = entry.toFixed(asset.dp);
    }
    if (!isFinite(entry)) { $('rcHeadline').innerHTML = '<span style="color:var(--err)">' + t('rcErrNeedEntry') + '</span>'; $('rcKv').innerHTML = ''; return; }
    if (!isFinite(stop)) {
      stop = (lastAnalysis && isFinite(lastAnalysis.suggestStop)) ? lastAnalysis.suggestStop : entry * 0.95;
      $('rcStop').value = stop.toFixed(asset.dp);
    }
    if (!isFinite(capital) || capital <= 0) { capital = 100000; $('rcCapital').value = capital; }
    if (!isFinite(riskPct) || riskPct <= 0) { riskPct = 2; $('rcRiskPct').value = riskPct; }

    var res = riskCalc({ capital: capital, riskPct: riskPct, entry: entry, stop: stop, resistance: lastAnalysis ? lastAnalysis.resistance : NaN });
    if (res.error) { $('rcHeadline').innerHTML = '<span style="color:var(--err)">' + res.error + '</span>'; $('rcKv').innerHTML = ''; return; }
    $('rcHeadline').innerHTML = t('rcQtyLine', { qty: fmt(res.qty, 4), cost: fmt(res.cost, 0) });
    var kv = '';
    kv += '<div class="k">' + t('rcKvIfWrong') + '</div><div class="v">' + fmt(res.riskAmt, 0) + '</div>';
    kv += '<div class="k">' + t('rcKvStop') + '</div><div class="v">' + fmt(stop, asset.dp) + '</div>';
    if (isFinite(res.rr)) kv += '<div class="k">' + t('rcKvRr') + '</div><div class="v">' + fmt(res.rr, 1) + ' : 1</div>';
    if (res.note) kv += '<div class="k" style="color:var(--warn)">ℹ️</div><div class="v" style="color:var(--warn);font-size:12px">' + res.note + '</div>';
    $('rcKv').innerHTML = kv;
  }

  /* ── เช็กลิสต์ก่อนซื้อ ─────────────────────────────────────────── */
  function checklistChecks() {
    var a = lastAnalysis, det = (a && a.det) ? a.det : {};
    var entry = num($('rcEntry').value), stop = num($('rcStop').value), riskPct = num($('rcRiskPct').value);
    var checks = [];
    if (a && isFinite(det.ema20)) {
      var up = isFinite(det.ema50) ? a.price >= det.ema50 : a.price >= det.ema20;
      var adxTxt = isFinite(det.adx) ? t('chkAdxSuffix', { v: det.adx.toFixed(0), label: det.adx >= 20 ? t('chkAdxStrong') : t('chkAdxWeak') }) : '';
      checks.push({ ok: up, txt: (up ? t('chkTrendUp') : t('chkTrendDn')) + adxTxt });
      var over = (a.price - det.ema20) / det.ema20, notChase = over <= 0.05;
      checks.push({ ok: notChase, txt: notChase ? t('chkNoChase') : t('chkChasing') });
    } else {
      checks.push({ ok: null, txt: t('chkTrendNeedData') });
    }
    if (a && isFinite(det.rsi)) checks.push({ ok: det.rsi < 70, txt: det.rsi < 70 ? t('chkRsiOk', { v: det.rsi.toFixed(0) }) : t('chkRsiHot', { v: det.rsi.toFixed(0) }) });
    else checks.push({ ok: null, txt: t('chkRsiNeedData') });
    var stopOk = isFinite(entry) && isFinite(stop) && stop < entry;
    checks.push({ ok: stopOk, txt: stopOk ? t('chkStopSet') : t('chkStopUnset') });
    checks.push({
      ok: isFinite(riskPct) && riskPct <= 2,
      txt: (isFinite(riskPct) && riskPct <= 2) ? t('chkRiskOk', { v: riskPct }) : t('chkRiskHigh', { v: isFinite(riskPct) ? riskPct + '%' : '-' })
    });
    if (a && stopOk && isFinite(a.resistance) && a.resistance > entry) {
      var rr = (a.resistance - entry) / (entry - stop), rrOk = rr >= 2;
      checks.push({ ok: rrOk, txt: rrOk ? t('chkRrOk', { v: rr.toFixed(1) }) : t('chkRrLow', { v: rr.toFixed(1) }) });
    } else {
      checks.push({ ok: null, txt: t('chkRrNeedData') });
    }
    var lv = cAnswers.noLeverage;
    checks.push({
      ok: lv === 'yes' ? true : lv === 'no' ? false : null,
      txt: lv === 'yes' ? t('chkLeverageYes') : lv === 'no' ? t('chkLeverageNo') : t('chkLeverageUnknown')
    });
    return checks;
  }
  function doChecklist() {
    var checks = checklistChecks();
    var fails = checks.filter(function (c) { return c.ok === false; }).length;
    var unknowns = checks.filter(function (c) { return c.ok === null; }).length;
    var box = $('checkResult'), v = $('checkVerdict');
    if (fails > 0) { v.className = 'verdict-box no'; v.textContent = t('checklistFail', { n: fails }); }
    else if (unknowns > 0) { v.className = 'verdict-box warn'; v.textContent = t('checklistUnknown'); }
    else { v.className = 'verdict-box go'; v.textContent = t('checklistGo'); }
    var html = '';
    checks.forEach(function (c) {
      var ic = c.ok === true ? '' : c.ok === false ? '' : '◻️';
      html += '<li class="' + (c.ok === false ? 'fail' : 'pass') + '"><span class="ic">' + ic + '</span><span>' + c.txt + '</span></li>';
    });
    $('chkList').innerHTML = html;
    box.style.display = 'block';
  }

  /* ══════ สรุปด้วย AI — ใช้ ai-chat-worker.js ตัวเดียวกับวิดเจ็ตแชทลอย (ai-chat-widget.js)
     รันในเครื่องผู้ใช้เอง ไม่ส่งข้อมูลออกไปไหน แนวทาง "guided summarization" เดียวกับหน้าอื่น —
     ป้อน "ตัวเลข/สัญญาณที่หน้านี้คำนวณไว้ให้แล้ว" (จาก analyzeSeries() ด้านบน) ตรงๆ ให้โมเดล
     กันโมเดลเล็กต้องมาคำนวณ/ตีความตัวเลขเอง ── */
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

  function isIOS() {
    if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) return true;
    return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  }
  /* โมเดลเล็ก (0.5B) บางครั้ง "พูดตาม" ข้อความ system/reminder ที่สั่งห้ามทำนี่นั่นออกมาเป็นเนื้อหาจริง
     แทนที่จะทำตามคำสั่งเงียบๆ (เจอจริง: ตอบ "ห้ามให้คำแนะนำซื้อ/ขาย" เป็นบรรทัดแยกในคำตอบ) — กรองทิ้งบรรทัด
     ที่ขึ้นต้นด้วย "ห้าม"/"Never" ออกก่อนแสดงผลและก่อนแคช เพราะไม่ใช่หัวข้อเนื้อหาจริงตามโครงสร้างที่กำหนด */
  function stripLeakedInstructions(text) {
    return (text || '').split('\n').filter(function (line) {
      return !/^\s*(ห้าม|Never\b)/i.test(line);
    }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  function friendlyChatError(rawMessage) {
    var msg = rawMessage || '';
    if (/bad_alloc|Can't create a session|out of memory/i.test(msg)) return t('memErrorMsg');
    if (/QuotaExceededError|quota.{0,20}exceeded|not enough.{0,10}(space|storage)|no space left/i.test(msg)) return t('diskErrorMsg');
    return msg;
  }

  var aiSumChatWorker = null, aiSumWorkerRacePromise = null, aiSumJobSeq = 0, aiSumBusy = false;
  function spawnProbedWorker(modelKind) {
    return new Promise(function (resolve, reject) {
      var w = new Worker('./ai-chat-worker.js', { type: 'module' });
      var probeId = 'probe-' + modelKind + '-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      function onMsg(e) {
        var msg = e.data;
        if (!msg || msg.jobId !== probeId || msg.type !== 'probe-result') return;
        w.removeEventListener('message', onMsg); w.removeEventListener('error', onErr);
        if (msg.ok) resolve(w);
        else { try { w.terminate(); } catch (err) {} reject(new Error(msg.message || 'probe failed')); }
      }
      function onErr(e) {
        w.removeEventListener('message', onMsg); w.removeEventListener('error', onErr);
        try { w.terminate(); } catch (err) {}
        reject(e);
      }
      w.addEventListener('message', onMsg);
      w.addEventListener('error', onErr);
      w.postMessage({ type: 'probe', jobId: probeId, modelId: modelKind });
    });
  }
  /* คืน Promise<Worker> — เครื่องมี WebGPU+แรมพอ จะสร้าง worker แยกกันคนละตัวลองโมเดลใหญ่/เล็กพร้อมกัน
     (คนละ WASM memory จริงๆ ไม่แชร์กัน ต่างจากที่เคยพังมาก่อน) ตัวไหนพร้อมก่อนก็ใช้ตัวนั้น ตัวใหญ่พัง
     ไม่กระทบตัวเล็กเลยเพราะคนละ worker — ดูรายละเอียดที่คอมเมนต์หัวไฟล์ ai-chat-worker.js
     ⚠️ 2026-09-19: จำผลไว้ใน localStorage ด้วยว่าโมเดลใหญ่เคยพังบนเบราว์เซอร์นี้ไหม (เจอจริงจากผู้ใช้ที่
     navigator.gpu รายงานว่ารองรับแต่โหลดจริงพังทุกครั้ง) — ถ้าเคยพังแล้ว "ไม่ลองอีกเลย" ในครั้งถัดๆ ไป
     กันไม่ให้เสียแบนด์วิดท์/ซีพียูไปกับการดาวน์โหลดโมเดลใหญ่ที่รู้อยู่แล้วว่าจะพังซ้ำๆ ทุกครั้งที่กดสรุป
     ซึ่งทำให้โมเดลเล็ก (ตัวที่ใช้งานได้จริง) โหลดช้าลงไปด้วยเพราะแย่งแบนด์วิดท์กัน */
  var AI_BIG_MODEL_BLOCKLIST_KEY = 'tanot:aiChat:noBigModel';
  function getAiSumWorkerAsync() {
    if (aiSumChatWorker) return Promise.resolve(aiSumChatWorker);
    if (aiSumWorkerRacePromise) return aiSumWorkerRacePromise;
    var mem = (typeof navigator !== 'undefined') ? navigator.deviceMemory : undefined;
    var noBig = false;
    try { noBig = localStorage.getItem(AI_BIG_MODEL_BLOCKLIST_KEY) === '1'; } catch (e) {}
    var canTryBig = !noBig && typeof navigator !== 'undefined' && !!navigator.gpu && mem && mem >= 4;
    var candidates;
    if (canTryBig) {
      var bigP = spawnProbedWorker('big').catch(function (err) {
        try { localStorage.setItem(AI_BIG_MODEL_BLOCKLIST_KEY, '1'); } catch (e2) {}
        throw err;
      });
      candidates = [bigP, spawnProbedWorker('small')];
    } else {
      candidates = [spawnProbedWorker('small')];
    }
    aiSumWorkerRacePromise = Promise.any(candidates).then(function (winner) {
      aiSumChatWorker = winner; aiSumWorkerRacePromise = null;
      candidates.forEach(function (p) { p.then(function (w) { if (w !== winner) { try { w.terminate(); } catch (err) {} } }, function () {}); });
      return winner;
    }, function () {
      aiSumWorkerRacePromise = null;
      var w = new Worker('./ai-chat-worker.js', { type: 'module' });
      aiSumChatWorker = w;
      return w;
    });
    return aiSumWorkerRacePromise;
  }
  function setAiSumStatus(text, cls) { var el = $('aiSumStatus'); if (!el) return; el.textContent = text || ''; el.className = 'status' + (cls ? ' ' + cls : ''); }

  function buildAiSumContext() {
    var a = lastAnalysis; if (!a || !curKey) return null;
    var asset = byKey[curKey]; if (!asset) return null;
    var unit = assetUnit(asset), label = assetLabel(asset);
    var lines = [t('ctxAsset', { label: label, unit: unit }), t('ctxLatestPrice', { v: fmt(a.price, asset.dp), unit: unit }), t('ctxVerdict', { v: a.verdict, why: a.why })];
    if (a.pros && a.pros.length) lines.push(t('ctxPros', { v: a.pros.join(', ') }));
    if (a.cons && a.cons.length) lines.push(t('ctxCons', { v: a.cons.join(', ') }));
    var d = a.det || {};
    if (isFinite(d.rsi)) lines.push(t('ctxRsi', { v: fmt(d.rsi, 1) }) + (d.rsi > 70 ? t('ctxRsiHigh') : d.rsi < 38 ? t('ctxRsiLow') : t('ctxRsiMid')));
    if (isFinite(d.macdHist)) lines.push(t('ctxMacd', { v: fmt(d.macdHist, 4) }) + (d.macdHist >= 0 ? t('ctxMacdPos') : t('ctxMacdNeg')));
    if (isFinite(d.ema20) && isFinite(d.ema50)) lines.push(t('ctxEma', { e20: fmt(d.ema20, asset.dp), e50: fmt(d.ema50, asset.dp) }) + (a.uptrend ? t('ctxEmaUp') : t('ctxEmaDn')));
    if (isFinite(d.support)) lines.push(t('ctxSupport', { v: fmt(d.support, asset.dp) }));
    if (isFinite(d.resistance)) lines.push(t('ctxResistance', { v: fmt(d.resistance, asset.dp) }));
    if (isFinite(d.adx)) lines.push(t('ctxAdx', { v: fmt(d.adx, 0) }) + (d.adx >= 20 ? t('ctxAdxStrong') : t('ctxAdxWeak')));
    return lines.join('\n');
  }

  /* แคชผลสรุปผ่าน Firebase (ai-summary-cache.js) — ดูรายละเอียด/ข้อจำกัดที่ตั้งใจไว้ในไฟล์นั้น
     (invest-global-stock.js เป็นหน้าแรกที่ทำ pattern นี้ ดูคอมเมนต์เต็มๆ ที่นั่น) — หน้านี้เลือกโภคภัณฑ์
     ได้หลายตัว จึงใช้ curKey (คีย์โภคภัณฑ์ที่กำลังดูอยู่ เช่น 'wti','gold') เป็นส่วนหนึ่งของคีย์แคชด้วย */
  var AI_CACHE_PAGE = 'commodities';
  function doAiSummary() {
    if (aiSumBusy) return;
    if (isIOS()) { setAiSumStatus(t('iosNotSupported'), 'err'); return; }
    var ctx = buildAiSumContext();
    if (!ctx) { setAiSumStatus(t('needStockData'), 'err'); return; }

    aiSumBusy = true;
    $('aiSumBtn').disabled = true;
    $('aiSumOut').style.display = 'none'; $('aiSumOut').textContent = '';
    setAiSumStatus(t('summarizing'), '');

    var isEn = getUILang() === 'en';
    var cacheSym = curKey || 'unknown', cacheLang = isEn ? 'en' : 'th';
    var cache = window.AiSummaryCache;
    (cache ? cache.read(AI_CACHE_PAGE, cacheSym, cacheLang) : Promise.resolve(null)).then(function (hit) {
      if (hit) {
        $('aiSumOut').style.display = 'block'; $('aiSumOut').textContent = stripLeakedInstructions(hit.text);
        setAiSumStatus(t('summarizeCached'), 'ok');
        aiSumBusy = false; $('aiSumBtn').disabled = false;
        return;
      }
      runLocalSummary();
    });

    function runLocalSummary() {
      var payloadMessages = [
        { role: 'system', content: isEn ? AI_SUMMARY_SYSTEM_PROMPT_EN : AI_SUMMARY_SYSTEM_PROMPT },
        { role: 'user', content: ctx },
        { role: 'system', content: isEn ? AI_SUMMARY_REMINDER_EN : AI_SUMMARY_REMINDER }
      ];
      var jobId = ++aiSumJobSeq, replyText = '';
      getAiSumWorkerAsync().then(function (w) {
        if (jobId !== aiSumJobSeq) return; // มีคำขอใหม่กว่าแทรกมาระหว่างรอ worker พร้อม ทิ้งอันนี้ไป

        function onMsg(e) {
          var msg = e.data;
          if (!msg || msg.jobId !== jobId) return;
          if (msg.type === 'model-progress') {
            var pct = msg.progress != null ? Math.round(msg.progress) + '%' : '';
            setAiSumStatus(t('loadingModel', { file: msg.file, pct: pct }), '');
          } else if (msg.type === 'fallback') {
            setAiSumStatus('' + msg.message, '');
          } else if (msg.type === 'token') {
            if (!replyText) { setAiSumStatus('', ''); $('aiSumOut').style.display = 'block'; }
            replyText += msg.token;
            $('aiSumOut').textContent = stripLeakedInstructions(replyText);
          } else if (msg.type === 'done') {
            cleanup();
            var finalText = stripLeakedInstructions(replyText);
            if (!finalText) setAiSumStatus(t('summarizeFail'), 'err');
            else { $('aiSumOut').textContent = finalText; if (cache) cache.write(AI_CACHE_PAGE, cacheSym, cacheLang, { text: finalText }); }
            aiSumBusy = false; $('aiSumBtn').disabled = false;
          } else if (msg.type === 'error') {
            cleanup();
            resetWorkerOnError();
            $('aiSumOut').style.display = 'none'; $('aiSumOut').textContent = '';
            setAiSumStatus(t('summarizeFailWith', { msg: friendlyChatError(msg.message) }), 'err');
            aiSumBusy = false; $('aiSumBtn').disabled = false;
          }
        }
        function onErr(e) {
          cleanup();
          resetWorkerOnError();
          $('aiSumOut').style.display = 'none'; $('aiSumOut').textContent = '';
          setAiSumStatus(t('summarizeFailWith', { msg: friendlyChatError(e.message || t('unknownReason')) }), 'err');
          aiSumBusy = false; $('aiSumBtn').disabled = false;
        }
        function cleanup() { w.removeEventListener('message', onMsg); w.removeEventListener('error', onErr); }
        function resetWorkerOnError() { try { w.terminate(); } catch (e) {} aiSumChatWorker = null; }
        w.addEventListener('message', onMsg);
        w.addEventListener('error', onErr);
        w.postMessage({ type: 'chat', jobId: jobId, messages: payloadMessages, maxNewTokens: 220 });
      });
    }
  }

  function setDetailStatus(msg, cls) {
    var el = $('dSrcBadge'); el.textContent = msg; el.className = 'src-badge' + (cls ? ' ' + cls : '');
  }

  function selectAsset(key) {
    var a = byKey[key]; if (!a) return;
    var switchingAsset = curKey !== key; /* false เมื่อเรียกซ้ำจาก omeApplyLang ตอนสลับภาษา (asset เดิม) */
    curKey = key;
    try { localStorage.setItem(LAST_KEY, key); } catch (e) {}
    [].forEach.call(document.querySelectorAll('.stat-card, .pill'), function (el) { el.classList.toggle('on', el.getAttribute('data-key') === key); });
    $('dIcon').textContent = a.icon; $('dName').textContent = assetLabel(a); $('dUnit').textContent = assetUnit(a);
    $('ohlcRow').style.display = 'none';
    fullData = null;

    /* รีเซ็ตการ์ดไฟจราจร/สรุปด้วย AI เป็นสถานะ "กำลังโหลด" ทันทีที่สลับสินทรัพย์ กันโชว์ผลของตัวเก่าค้าง */
    $('vLight').className = 'light gray'; $('vBulb').style.background = '#B8C0D4';
    $('vVerdict').textContent = t('loadingDefault'); $('vWhy').textContent = '';
    $('vDetailsBox').style.display = 'none'; $('aiSumCard').style.display = 'none';

    /* รีเซ็ตช่องราคาซื้อ/ตัดขาดทุนและผลลัพธ์ของการ์ดคำนวณความเสี่ยง/เช็กลิสต์ทิ้ง เฉพาะตอนสลับไปสินทรัพย์อื่นจริงๆ
       (แต่ละสินทรัพย์คนละหน่วย/สกุลเงินกัน ใช้เลขค้างจากตัวก่อนหน้าไม่ได้ — แต่ตอนสลับแค่ภาษาไม่ต้องรีเซ็ต
       กัน omeApplyLang เรียกซ้ำแล้วผลที่เพิ่งคำนวณไว้หายไปโดยไม่จำเป็น) */
    if (switchingAsset) {
      $('rcEntry').value = ''; $('rcStop').value = '';
      $('rcResult').style.display = 'none'; $('checkResult').style.display = 'none';
    }

    if (a.kind === 'thaigold') {
      setDetailStatus(t('loadingDefault'));
      if (chart) { try { chart.remove(); } catch (e) {} chart = null; seriesObj = null; }
      $('lwChart').style.display = 'none';
      $('chartCap').style.display = 'none';
      $('chartEmpty').style.display = 'block';
      $('chartEmpty').textContent = t('goldNoHistEmpty');
      $('histTitle').textContent = t('goldNoHistTitle');
      $('histTable').innerHTML = '';
      showVerdict(null);
      getThaiGold().then(function (r) {
        setDetailStatus(r.stale ? t('goldStale') : t('goldLiveToday') + (r.data.updateDate ? (' · ' + r.data.updateDate) : ''), 'real');
        writeCard(a, r.data[a.field], NaN);
      }, function () { setDetailStatus(t('goldFail'), 'paste'); });
      return;
    }

    setDetailStatus(t('loadingChart'));
    $('lwChart').style.display = 'none'; $('chartEmpty').style.display = 'block'; $('chartEmpty').textContent = t('loadingDefault');

    var seriesPromise;
    if (a.kind === 'yahoo') {
      seriesPromise = getSeries(a.sym).then(function (r) { return { s: r.series, stale: r.stale, cachedAt: r.cachedAt }; });
    } else {
      seriesPromise = Promise.all([getSeries(a.a), getSeries(a.b)]).then(function (r) {
        return { s: crossSeries(a, r[0].series, r[1].series), stale: r[0].stale || r[1].stale, cachedAt: r[0].cachedAt };
      });
    }
    seriesPromise.then(function (r) {
      if (curKey !== key) return; /* ผู้ใช้กดการ์ดอื่นไปแล้วระหว่างรอโหลด */
      if (!r.s.times.length) throw new Error('empty');
      fullData = r.s;
      setDetailStatus(r.stale ? t('seriesStale') : t('seriesReal'), 'real');
      if (!buildChart(r.s)) setDetailStatus(t('chartLibFail'), 'paste');
      renderHistTable(r.s, a);
      showVerdict(analyzeSeries(r.s), a);
    }, function () {
      if (curKey !== key) return;
      setDetailStatus(t('seriesFail'), 'paste');
      $('chartEmpty').textContent = t('chartEmptyFail');
      $('histTitle').textContent = t('histTitleFail');
      $('histTable').innerHTML = '';
      showVerdict(null);
    });
  }

  /* ── init ───────────────────────────────────────────────────── */
  function init() {
    applyStaticI18n();
    buildGrid();
    [].forEach.call(document.querySelectorAll('#tfGroup .tf'), function (b) {
      b.addEventListener('click', function () { applyTF(+b.getAttribute('data-tf')); });
    });
    [].forEach.call(document.querySelectorAll('#ctypeGroup button'), function (b) {
      b.addEventListener('click', function () {
        curType = b.getAttribute('data-ct');
        [].forEach.call(document.querySelectorAll('#ctypeGroup button'), function (x) { x.classList.toggle('on', x === b); });
        if (fullData) buildChart(fullData);
      });
    });
    $('aiSumBtn').addEventListener('click', doAiSummary);
    $('rcCalcBtn').addEventListener('click', doCalc);
    $('chkForm').addEventListener('click', function (e) {
      var btn = e.target.closest('.yn-btn'); if (!btn) return;
      var row = btn.closest('.yn-row'), key = row.getAttribute('data-key'), val = btn.getAttribute('data-val');
      cAnswers[key] = val;
      [].forEach.call(row.querySelectorAll('.yn-btn'), function (b) { b.classList.remove('on', 'yes', 'no'); });
      btn.classList.add('on', val);
    });
    $('checkBtn').addEventListener('click', doChecklist);
    var last = null;
    try { last = localStorage.getItem(LAST_KEY); } catch (e) {}
    selectAsset(byKey[last] ? last : 'gc');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.omeApplyLang = function () {
    applyStaticI18n();
    buildGrid();
    if (curKey) selectAsset(curKey);
    if ($('rcResult').style.display !== 'none') doCalc();
    if ($('checkResult').style.display !== 'none') doChecklist();
  };

  window.__commodities = { crossVal: crossVal, ASSETS: ASSETS };
})();
