/* ══════════════════════════════════════════════════════════════════
   Tanot — ทองคำ (แท็บ #gold ของ invest-gold.html) — ยุบรวมหน้าลงทุน ขั้น 9 (docs/invest-consolidation-design.md หัวข้อ 2/3)
   • ราคาทองไทย: InvestCore.thaiGold() (thai-gold-api, แคช tanot:invest:cache:gold:th รูปแบบเดิม) + กรอกเอง
   • ไฟจราจร "ถูก/แพงตอนนี้ไหม": InvestCalc.analyzeSeries บนราคาทองโลก GC=F (InvestCore.series → แคช cache:gold:GC=F)
   • คุมเงิน/เช็กลิสต์/DCA/ตลาดย่อ: InvestCalc.riskCalc.gold · checklist.gold · simulateDCA · drawdown
   • สมุดทอง tanot:invest:gold {type,unit,amt,price,weight,ts} — รูปแบบเดิม · อ่านสด→แก้→เขียน · ลบด้วย ts
     มูลค่า: ทองแท่ง = ราคารับซื้อทองแท่ง · รูปพรรณ = ราคารับซื้อรูปพรรณ · กรัม→บาททองคำ 15.244 (แท่ง) / 15.16 (รูปพรรณ) (InvestCalc.GRAM_PER_BAHT)
   • สรุปด้วย AI: คลาวด์อย่างเดียว (task 'stock:gold') · ไม่มีสัดส่วนทอง/Google Drive แล้ว (ซิงก์ผ่าน D1)
   หมายเหตุ: ตัวช่วยคิด ไม่ใช่คำแนะนำการลงทุน
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var IC = window.InvestCore, Calc = window.InvestCalc;
  var $ = function (id) { return document.getElementById(id); };
  var LOG_KEY = 'tanot:invest:gold';
  var GRAM = Calc.GRAM_PER_BAHT;

  var lastGoldPlan = { pmt: 3000 }, lastVerdictMode = 'real', lastAnalysis = null, gAnswers = { spotOnly: null };
  var inited = false, curTab = 'gold', tabsCtl = null;

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }
  function fmt(n, d) { return IC.fmt(n, d); }
  function fmt0(n) { return isFinite(n) ? Math.round(n).toLocaleString('th-TH') : '—'; }
  function baht(n) { if (!isFinite(n)) return '—'; var neg = n < 0; return (neg ? '−' : '') + '฿' + Math.round(Math.abs(n)).toLocaleString('th-TH'); }
  function esc(s) { return IC.esc(s); }
  /* กรัม → บาททองคำ ตามชนิด (แท่ง 15.244 · รูปพรรณ 15.16) */
  function toBahtWeight(w, unit, type) { return unit === 'gram' ? w / GRAM[type === 'jewelry' ? 'jewelry' : 'bar'] : w; }

  var L = IC.i18n({
    th: {
      delTitle: 'ลบ', rcKvNote: 'หมายเหตุ',
      crumbHome: 'การลงทุน', tabGold: 'ทองคำ', tabMarkets: 'ค่าเงิน & วัตถุดิบ',
      pageTitle: 'ทองคำ — ราคาวันนี้ + วางแผนออมทอง', pageTitleMarkets: 'ค่าเงิน & วัตถุดิบ',
      priceTitle: 'ราคาทองวันนี้ (บาท/บาททองคำ)',
      barBuyLabel: 'ทองคำแท่ง — ราคาซื้อ', boughtUnit: '(คุณจ่าย)', barSellLabel: 'ทองคำแท่ง — ราคาขายคืน', receivedUnit: '(คุณได้รับ)',
      jewelryBuyLabel: 'ทองรูปพรรณ — ราคาซื้อ', jewelrySellLabel: 'ทองรูปพรรณ — ราคาขายคืน',
      goldThStatusDefault: 'กำลังดึงราคาทองวันนี้…', refreshPriceBtn: 'รีเฟรชราคา',
      verdictTitle: 'ถูก/แพงตอนนี้ไหม',
      gSrcBadgeDefault: 'กำลังตรวจแนวโน้ม…', gVerdictLoadingDefault: 'กำลังโหลด…', chipLoadingDefault: 'กำลังโหลด…',
      techDetailsSummary: 'ดูรายละเอียดทางเทคนิค (USD/ออนซ์ ไม่ต้องเข้าใจก็ได้)',
      gPriceUsdLabel: 'ราคาทองโลกตอนนี้', unitUsdOz: '(USD/ออนซ์)', gHiUsdLabel: 'สูงสุดของรอบ', gLoUsdLabel: 'ต่ำสุดของรอบ', manualEvalBtn: 'ประเมินจากราคานี้',
      dcaTitle: 'วางแผนออมทอง (DCA)',
      dcaPmtLabel: 'ออมเดือนละ', unitBaht: '(บาท)', dcaUnitLabel: 'หน่วยที่แสดงผล', unitBahtGold: 'บาททองคำ', unitGram: 'กรัม',
      dcaYearsLabel: 'วางแผนล่วงหน้า', unitYears: '(ปี)', dcaStartLabel: 'ราคาทองเริ่มต้น', unitBahtPerBahtGold: '(บาท/บาททองคำ)', dcaStartPh: 'รอราคาวันนี้โหลด…',
      dcaCagrLabel: 'สมมติราคาทองโตเฉลี่ย', unitPctYear: '(%/ปี)', calcPlanBtn: 'คำนวณแผน',
      dcaContribLabel: 'เงินที่ลงทั้งหมด', dcaWeightLabel: 'น้ำหนักทองที่สะสมได้', dcaValueLabel: 'มูลค่าประมาณสิ้นแผน', dcaGainLabel: 'กำไรจากราคาที่เปลี่ยน',
      chartValue: 'มูลค่ารวม', chartCost: 'เงินที่ใส่ (ต้นทุน)', viewYearTableSummary: 'ดูตารางรายปี',
      ddTitle: 'ตลาดย่อ = โอกาสเติมทอง (ทางเลือก)', gdNowLabel: 'ราคาทองตอนนี้', gdNowPh: 'เติมจากราคาวันนี้อัตโนมัติ',
      gdAthLabel: 'จุดสูงสุดที่เคยเห็น (ATH)', gdAthPh: 'กรอกเอง', ddBtn: 'ดูคำแนะนำ',
      tr10m: 'ย่อเล็ก', tr20m: 'ย่อแรง', tr30m: 'ย่อหนักมาก',
      logTitle: 'สมุดทองของฉัน',
      lgTypeLabel: 'ชนิด', typeBar: 'ทองคำแท่ง', typeJewelry: 'ทองรูปพรรณ', lgUnitLabel: 'หน่วย',
      lgAmtLabel: 'เงินที่จ่าย', lgAmtPh: 'เช่น 35000', lgPriceLabel: 'ราคา/หน่วยที่ซื้อ', lgPricePh: 'เช่น 70950', lgAddBtn: 'เพิ่ม',
      lgEmptyDefault: 'ยังไม่มีรายการ',
      factorsSummary: 'ปัจจัยที่มีผลต่อราคาทองคำ', factDirectH: 'ปัจจัยทางตรง',
      factRealB: 'อัตราดอกเบี้ยที่แท้จริง (real rates)', factRealRest: ' — ทองไม่ให้ดอกเบี้ย/ปันผล ยิ่งดอกเบี้ยจริงสูง ยิ่งไม่จูงใจให้ถือทองเทียบกับพันธบัตร',
      factUsdB: 'ค่าเงินดอลลาร์สหรัฐฯ', factUsdRest: ' — ทองตั้งราคาเป็นดอลลาร์ ดอลลาร์แข็งมักกดราคาทอง (ผกผันกัน)',
      factTnxB: 'ดอกเบี้ยพันธบัตรสหรัฐฯ 10 ปี', factTnxRest: ' — ใช้ประกอบดูทิศทางดอกเบี้ยคร่าวๆ (ไม่ใช่ real rate โดยตรง)',
      factCbB: 'การซื้อทองสำรองของธนาคารกลาง', factCbRest: ' — ช่วงหลังหลายประเทศ (โดยเฉพาะตลาดเกิดใหม่) ซื้อทองสะสมทุนสำรองต่อเนื่อง เป็นแรงหนุนราคาระยะยาว',
      factInfB: 'การคาดการณ์เงินเฟ้อ', factInfRest: ' — ทองมักถูกมองเป็นสินทรัพย์ป้องกันเงินเฟ้อ',
      factIndirectH: 'ปัจจัยทางอ้อม',
      factGeoB: 'ความเสี่ยงภูมิรัฐศาสตร์/สงคราม', factGeoRest: ' — ความไม่แน่นอนสูงมักดันให้คนหันมาถือทองเป็นสินทรัพย์ปลอดภัย (safe haven)',
      factRecB: 'ความกลัวเศรษฐกิจถดถอย', factRecRest: ' — สัญญาณเศรษฐกิจอ่อนแอมักหนุนความต้องการถือสินทรัพย์ปลอดภัย',
      factVolB: 'ความผันผวนตลาดหุ้น', factVolRest: ' — ตลาดหุ้นผันผวน/ร่วงแรง มักมีเงินบางส่วนไหลเข้าทอง',
      factCcB: 'วิกฤตค่าเงิน/เงินทุนไหลออก', factCcRest: ' — ในประเทศตลาดเกิดใหม่ ทองมักเป็นที่พักเงินยามค่าเงินท้องถิ่นผันผวนหนัก',
      whyCheapRange: 'ราคาอยู่ช่วงถูกเทียบ 3 เดือน', whyExpensiveRange: 'ราคาอยู่ช่วงแพงเทียบ 3 เดือน',
      whyRsiLow: 'แรงขายเริ่มคลาย (RSI ต่ำ กำลังฟื้น)', whyRsiHigh: 'ราคาร้อนแรงเกินไป (RSI สูง เสี่ยงย่อ)',
      whyMomUp: 'โมเมนตัมเริ่มกลับเป็นบวก', whyMomDn: 'โมเมนตัมเริ่มอ่อนลง',
      whyUptrend: 'ยังอยู่ในแนวโน้มขึ้น', whyDowntrend: 'อยู่ใต้เส้นแนวโน้ม (ขาลง/พักตัว)',
      whyBbLow: 'ราคาแตะกรอบล่าง (มักเป็นจังหวะเด้ง)', whyBbHigh: 'ราคาชนกรอบบน', whyNeutral: 'ราคาอยู่กลางกรอบ ยังไม่มีสัญญาณชัด',
      vInterestingGold: 'น่าสนใจ — ราคาทองอยู่ในโซนถูกเทียบแนวโน้ม', vCarefulGold: 'ระวัง — ราคาทองแพงเทียบแนวโน้ม', vMidGold: 'กลางๆ — ยังไม่มีจังหวะเด่น',
      whyCheapPct: 'ราคาอยู่ค่อนไปทางถูกของรอบ (~{pct}% ของช่วง ต่ำ→สูง)', whyExpensivePct: 'ราคาอยู่ค่อนไปทางแพงของรอบ (~{pct}% ของช่วง ต่ำ→สูง)', whyMidPct: 'ราคาอยู่กลางกรอบ (~{pct}% ของช่วง ต่ำ→สูง)',
      goldThFetching: 'กำลังดึงราคาทองวันนี้…', manualEnterAll: 'กำลังกรอกราคาเอง… กรอกให้ครบทั้ง 4 ช่องเพื่อใช้งาน',
      badgeManualText: 'กรอกเอง', manualUsedStatus: 'ใช้ราคาที่กรอกเองแล้ว', badgeManualUsedText: 'ใช้ราคาที่กรอกเอง',
      fetchSuccess: 'ดึงราคาสำเร็จ',
      badgeRealLive: 'ราคาสด', badgeRealLiveUpdated: ' · ปรับปรุง {date} {time}',
      badgeStaleCache: 'ดึงสดไม่ได้ — ใช้ราคาที่บันทึกไว้ ({age})', statusStaleCache: 'ดึงสดไม่ได้ตอนนี้ — ใช้ราคาที่บันทึกไว้',
      statusFetchFailNoCache: 'ดึงราคาทองอัตโนมัติไม่ได้ตอนนี้ — กรอกเองในช่องด้านบน หรือลองรีเฟรชอีกครั้ง',
      badgeIntlTrend: 'แนวโน้มจากราคาทองคำโลก (GC=F)', badgeStaleSuffix: ' · ล่าสุด {age}', badgeDaysSuffix: ' · {days} วัน',
      badgeManualEval: 'ประเมินจากราคาที่กรอกเอง', badgeFetchFail: 'ดึงแนวโน้มราคาทองโลกไม่ได้ตอนนี้ — กรอกด้านล่างเพื่อประเมินเอง', gVerdictNoData: 'ยังไม่มีข้อมูล',
      detEma20: 'เส้นเฉลี่ย 20 วัน (EMA20)', detEma50: 'เส้นเฉลี่ย 50 วัน (EMA50)', detRsi: 'RSI (14)', detMacd: 'MACD histogram',
      detSupport: 'แนวรับล่าสุด', detResistance: 'แนวต้านล่าสุด', detAdx: 'ความแรงแนวโน้ม (ADX 14)', detAdxStrong: ' · แข็งแรง', detAdxWeak: ' · อ่อน', detNoData: '—',
      alertStartPrice: 'กรอกราคาทองเริ่มต้นให้ถูกต้อง (หรือรอราคาวันนี้โหลดก่อน แล้วลองอีกครั้ง)', alertPmt: 'กรอกเงินออมต่อเดือนให้ถูกต้อง',
      dcaContribSub: '{amt} บาท/เดือน × {months} เดือน', dcaWeightAltGram: '≈ {v} บาททองคำ', dcaWeightAltBaht: '≈ {v} กรัม',
      yrTableColYear: 'สิ้นปีที่', yrTableColContrib: 'เงินที่ใส่', yrTableColWeight: 'น้ำหนักสะสม', yrTableColValue: 'มูลค่า', yrRowLabel: 'ปีที่ {n}',
      unitGramShort: ' ก.', unitBahtGoldShort: ' บ.',
      ddNearAth: 'ตอนนี้ราคาใกล้จุดสูงสุด (ย่อ {dd}%) — ออมปกติเดือนละ {base} พอ ไม่ต้องเร่งเติม',
      ddNormal: 'ย่อลง <b>{dd}%</b> จากจุดสูงสุด — ยังถือว่าปกติ ออมตามแผนเดือนละ {base}',
      ddTierMsg: 'ย่อลง <b>{dd}%</b> จากจุดสูงสุด — ตามกฎที่ตั้งไว้ อาจเพิ่มเงินซื้อเดือนนี้เป็น <b>×{mult}</b> ≈ <b>{amt}</b> (ถ้ามีเงินสำรอง)',
      lgGroupSummaryGold: 'รวมซื้อ {amt} · {weight} บาททองคำ (≈ {gram} กรัม) · ต้นทุนเฉลี่ย {avg}/บาททองคำ',
      lgGroupValueNow: ' · มูลค่าตอนนี้ {val} <b style="color:{color}">({sign}{pl}, {sign2}{pct}%)</b>',
      logThDate: 'วันที่', logThType: 'ชนิด', logThPaid: 'เงินที่จ่าย', logThPricePerUnit: 'ราคา/หน่วยที่ซื้อ', logThWeight: 'น้ำหนักที่ได้',
      typeJewelryShort: 'รูปพรรณ', typeBarShort: 'แท่ง',
      alertAmtPrice: 'กรอกเงินที่จ่ายและราคา/หน่วยที่ซื้อให้ถูกต้อง', chipFetchFail: '— ดึงไม่ได้ตอนนี้',
      alertGPriceUsd: 'กรอกราคาทองโลกตอนนี้ก่อน', alertGHiLo: 'กรอกราคาสูงสุด/ต่ำสุดของรอบด้วยเพื่อประเมิน',
      aiSumTitle: 'สรุปราคาทองคำด้วย AI', aiSumBtn: 'สรุปให้หน่อย',
      needStockData: 'ยังไม่มีข้อมูลราคาให้สรุป — รอราคาทองโลกโหลด หรือกรอกเองแล้วประเมินก่อนนะครับ',
      summarizing: 'กำลังสรุป…', summarizeFail: 'สรุปไม่สำเร็จ ลองอีกครั้ง', summarizeFailWith: 'สรุปไม่สำเร็จ: {msg}',
      summarizeCached: 'ผลสรุปนี้คำนวณไว้แล้ว (โหลดจากแคช ไม่ต้องเรียก AI ใหม่)',
      ctxAsset: 'สินทรัพย์: ทองคำ (แนวโน้มราคาโลก USD/ออนซ์)', ctxLatestPrice: 'ราคาล่าสุด: {v} USD/ออนซ์', ctxVerdict: 'สัญญาณไฟจราจรที่คำนวณแล้ว: {v} ({why})',
      ctxPros: 'ปัจจัยหนุนที่ตรวจพบ: {v}', ctxCons: 'ปัจจัยเสี่ยงที่ตรวจพบ: {v}',
      ctxRsi: 'RSI (14 วัน): {v}', ctxRsiHigh: ' (สูง/ร้อนแรง)', ctxRsiLow: ' (ต่ำ/แรงขายเริ่มคลาย)', ctxRsiMid: ' (กลางๆ)',
      ctxMacd: 'MACD histogram: {v}', ctxMacdPos: ' (เป็นบวก)', ctxMacdNeg: ' (เป็นลบ)',
      ctxEma: 'เส้นเฉลี่ย 20 วัน: {e20}, เส้นเฉลี่ย 50 วัน: {e50}', ctxEmaUp: ' (ราคาอยู่เหนือเส้นเฉลี่ย — แนวโน้มขึ้น)', ctxEmaDn: ' (ราคาอยู่ใต้เส้นเฉลี่ย — แนวโน้มลง/พักตัว)',
      ctxSupport: 'แนวรับล่าสุด: {v}', ctxResistance: 'แนวต้านล่าสุด: {v}',
      ctxAdx: 'ความแรงแนวโน้ม (ADX): {v}', ctxAdxStrong: ' (แข็งแรง)', ctxAdxWeak: ' (อ่อน)',
      rcTitle: 'ถ้าจะซื้อ ควรใส่เงินเท่าไร ตั้งขายที่ไหน',
      rcCapitalLabel: 'เงินลงทุนทั้งพอร์ต (บาท)', rcCapitalPh: 'เช่น 300000',
      rcRiskPctLabel: 'ยอมเสี่ยงต่อครั้ง', rcUnitPctPortfolio: '(% ของพอร์ต)',
      rcEntryLabel: 'ราคาซื้อ (บาท/บาททองคำ)', rcEntryPh: '= ราคาทองคำแท่งวันนี้',
      rcStopLabel: 'ราคาตัดขาดทุน (บาท/บาททองคำ)', rcStopPh: 'แนะนำอัตโนมัติ',
      rcCalcBtn: 'คำนวณ',
      rcErrNeedEntry: 'กรอกราคาซื้อ (หรือรอราคาทองวันนี้โหลด) ก่อน',
      rcErrStop: 'ราคาตัดขาดทุนต้องต่ำกว่าราคาซื้อ',
      rcCapLimitedNote: 'จำกัดจำนวนตามเงินที่มี (ทุนไม่พอซื้อเท่าที่ความเสี่ยงอนุญาต)',
      rcQtyLine: 'ควรซื้อได้ประมาณ <b>{qty} บาททองคำ</b> ใช้เงิน ≈ <b>{cost}</b>',
      rcKvIfWrong: 'ถ้าผิดทาง (แตะ Stop) เสียไม่เกิน', rcKvStop: 'ราคาตัดขาดทุน (Stop)',
      rcKvRr: 'ความคุ้ม (กำไรคาดหวัง : ความเสี่ยง) ถึงแนวต้าน (ประมาณจากแนวโน้มราคาทองโลก)',
      checklistTitle: 'เช็กลิสต์ก่อนซื้อ — ควรซื้อไหม?',
      chkSpotOnly: 'ยืนยันว่าซื้อทองจริง (ทองคำแท่ง/รูปพรรณ) ไม่ใช่สัญญาซื้อขายล่วงหน้า/มาร์จิ้น',
      ynYes: 'ใช่', ynNo: 'ยัง', checkBtn: 'ตรวจเช็กลิสต์',
      chkTrendUp: 'อยู่ในแนวโน้มขึ้น (ราคาเหนือเส้นเฉลี่ย)', chkTrendDn: 'ยังไม่อยู่ในแนวโน้มขึ้น (ราคาใต้เส้นเฉลี่ย)',
      chkAdxSuffix: ' · ADX {v} {label}', chkAdxStrong: 'เทรนด์แข็งแรง', chkAdxWeak: 'เทรนด์อ่อน ควรระวัง',
      chkNoChase: 'ไม่ไล่ราคา (ห่างเส้นเฉลี่ย 20 ไม่เกิน 5%)', chkChasing: 'กำลังไล่ราคา (สูงกว่าเส้นเฉลี่ย 20 เกิน 5%)',
      chkTrendNeedData: 'แนวโน้ม/การไล่ราคา: ต้องรอราคาทองโลกโหลดก่อน',
      chkRsiOk: 'ไม่ร้อนแรงเกิน (RSI {v})', chkRsiHot: 'ร้อนแรงเกินไป (RSI {v} ≥ 70) เสี่ยงย่อ', chkRsiNeedData: 'RSI: ต้องรอราคาทองโลกโหลดก่อน',
      chkStopSet: 'ตั้งจุดตัดขาดทุน (Stop) แล้ว', chkStopUnset: 'ยังไม่ตั้งจุดตัดขาดทุน — กด "คำนวณ" ด้านบนก่อน',
      chkRiskOk: 'เสี่ยงต่อครั้ง ≤ 2% ({v}%)', chkRiskHigh: 'เสี่ยงต่อครั้งสูงไป ({v}) — ควร ≤ 2%',
      chkRrOk: 'กำไรคาดหวัง:เสี่ยง ≥ 2:1 ({v}:1)', chkRrLow: 'กำไร:เสี่ยงน้อยไป ({v}:1) — ควร ≥ 2:1',
      chkRrNeedData: 'กำไร:เสี่ยง: ต้องมีแนวต้านจากกราฟ + ตั้ง Stop ก่อน',
      chkSpotYes: 'ยืนยันแล้วว่าซื้อทองจริง ไม่ใช่สัญญาซื้อขายล่วงหน้า/มาร์จิ้น',
      chkSpotNo: 'กำลังจะใช้สัญญาซื้อขายล่วงหน้า/มาร์จิ้น — เสี่ยงถูกบังคับปิดสถานะจากความผันผวนระยะสั้น แนะนำซื้อทองจริงแทน',
      chkSpotUnknown: 'ยืนยันก่อนว่าซื้อทองจริง ไม่ใช่สัญญาซื้อขายล่วงหน้า/มาร์จิ้น (กดปุ่มด้านบน)',
      checklistFail: 'ยังไม่ควรซื้อ — ติด {n} ข้อ ควรแก้ให้ครบก่อนซื้อ',
      checklistUnknown: 'ข้อมูลไม่พอประเมินครบ — กด "คำนวณ" ด้านบนและตอบคำถามก่อน',
      checklistGo: 'ซื้อได้ตามแผน — ผ่านครบทุกข้อ (แต่ยังไม่การันตีกำไร ทำตามแผนและตัดขาดทุนเสมอ)'
    },
    en: {
      delTitle: 'Delete', rcKvNote: 'Note',
      crumbHome: 'Investing', tabGold: 'Gold', tabMarkets: 'FX & Commodities',
      pageTitle: "Gold — Today's Price + Savings Planner", pageTitleMarkets: 'FX & Commodities',
      priceTitle: "Today's Gold Price (baht/baht-weight)",
      barBuyLabel: 'Gold bar — buy price', boughtUnit: '(you pay)', barSellLabel: 'Gold bar — sell-back price', receivedUnit: '(you receive)',
      jewelryBuyLabel: 'Gold jewelry — buy price', jewelrySellLabel: 'Gold jewelry — sell-back price',
      goldThStatusDefault: "Fetching today's gold price…", refreshPriceBtn: 'Refresh price',
      verdictTitle: 'Is it cheap or expensive right now',
      gSrcBadgeDefault: 'Checking trend…', gVerdictLoadingDefault: 'Loading…', chipLoadingDefault: 'Loading…',
      techDetailsSummary: 'View technical details (USD/oz, no need to understand it)',
      gPriceUsdLabel: 'Global gold price now', unitUsdOz: '(USD/oz)', gHiUsdLabel: 'Period high', gLoUsdLabel: 'Period low', manualEvalBtn: 'Assess from this price',
      dcaTitle: 'Gold Savings Plan (DCA)',
      dcaPmtLabel: 'Save per month', unitBaht: '(baht)', dcaUnitLabel: 'Display unit', unitBahtGold: 'Baht-weight', unitGram: 'Grams',
      dcaYearsLabel: 'Plan ahead', unitYears: '(years)', dcaStartLabel: 'Starting gold price', unitBahtPerBahtGold: '(baht/baht-weight)', dcaStartPh: "Waiting for today's price to load…",
      dcaCagrLabel: 'Assumed average gold growth', unitPctYear: '(%/year)', calcPlanBtn: 'Calculate Plan',
      dcaContribLabel: 'Total contributed', dcaWeightLabel: 'Gold weight accumulated', dcaValueLabel: 'Estimated value at plan end', dcaGainLabel: 'Gain from price change',
      chartValue: 'Total value', chartCost: 'Money contributed (cost)', viewYearTableSummary: 'View year-by-year table',
      ddTitle: 'Market dip = a chance to add gold (optional)', gdNowLabel: 'Gold price now', gdNowPh: "Auto-filled from today's price",
      gdAthLabel: 'All-time high (ATH) seen', gdAthPh: 'Enter yourself', ddBtn: 'Get recommendation',
      tr10m: 'Small dip', tr20m: 'Sharp dip', tr30m: 'Very heavy dip',
      logTitle: 'My Gold Log',
      lgTypeLabel: 'Type', typeBar: 'Gold bar', typeJewelry: 'Gold jewelry', lgUnitLabel: 'Unit',
      lgAmtLabel: 'Amount paid', lgAmtPh: 'e.g. 35000', lgPriceLabel: 'Price/unit paid', lgPricePh: 'e.g. 70950', lgAddBtn: 'Add',
      lgEmptyDefault: 'No entries yet',
      factorsSummary: 'Factors That Affect the Gold Price', factDirectH: 'Direct factors',
      factRealB: 'Real interest rates', factRealRest: ' — gold pays no interest/dividends, so higher real rates make holding gold less attractive versus bonds',
      factUsdB: 'US dollar strength', factUsdRest: ' — gold is priced in dollars, a stronger dollar usually pushes the gold price down (inverse relationship)',
      factTnxB: 'US 10-year treasury yield', factTnxRest: ' — used as a rough gauge of interest-rate direction (not a direct real rate)',
      factCbB: 'Central bank gold reserve buying', factCbRest: ' — in recent years many countries (especially emerging markets) have continuously bought gold to build reserves, a long-term price support',
      factInfB: 'Inflation expectations', factInfRest: ' — gold is often viewed as an inflation hedge',
      factIndirectH: 'Indirect factors',
      factGeoB: 'Geopolitical risk/war', factGeoRest: ' — high uncertainty usually pushes people toward gold as a safe haven asset',
      factRecB: 'Recession fears', factRecRest: ' — weak economic signals usually boost demand for safe-haven assets',
      factVolB: 'Stock market volatility', factVolRest: ' — when stock markets are volatile/falling sharply, some money usually flows into gold',
      factCcB: 'Currency crises/capital outflows', factCcRest: ' — in emerging markets, gold is often a place to park money when the local currency is highly volatile',
      whyCheapRange: 'Price is in the cheap part of the 3-month range', whyExpensiveRange: 'Price is in the expensive part of the 3-month range',
      whyRsiLow: 'Selling pressure easing (RSI low, starting to recover)', whyRsiHigh: 'Price is overheated (RSI high, risk of a pullback)',
      whyMomUp: 'Momentum is turning positive', whyMomDn: 'Momentum is weakening',
      whyUptrend: 'Still in an uptrend', whyDowntrend: 'Below the trend line (downtrend/consolidation)',
      whyBbLow: 'Price is touching the lower band (often a bounce point)', whyBbHigh: 'Price is hitting the upper band', whyNeutral: 'Price is in the middle of the range, no clear signal yet',
      vInterestingGold: 'Interesting — gold price is in a cheap zone relative to the trend', vCarefulGold: 'Careful — gold price is expensive relative to the trend', vMidGold: 'Neutral — no standout opportunity yet',
      whyCheapPct: 'Price is toward the cheap end of the range (~{pct}% of low→high)', whyExpensivePct: 'Price is toward the expensive end of the range (~{pct}% of low→high)', whyMidPct: 'Price is in the middle of the range (~{pct}% of low→high)',
      goldThFetching: "Fetching today's gold price…", manualEnterAll: 'Entering price manually… fill in all 4 fields to use this',
      badgeManualText: 'Entered manually', manualUsedStatus: 'Now using the manually entered price', badgeManualUsedText: 'Using manually entered price',
      fetchSuccess: 'Fetched price successfully',
      badgeRealLive: 'Live price', badgeRealLiveUpdated: ' · updated {date} {time}',
      badgeStaleCache: 'Live fetch failed — using saved price ({age})', statusStaleCache: 'Live fetch failed right now — using the saved price',
      statusFetchFailNoCache: "Couldn't auto-fetch the gold price right now — enter it yourself in the fields above, or try refreshing again",
      badgeIntlTrend: 'Trend from the global gold price (GC=F)', badgeStaleSuffix: ' · latest {age}', badgeDaysSuffix: ' · {days} days',
      badgeManualEval: 'Assessed from manually entered price', badgeFetchFail: "Couldn't fetch the global gold trend right now — enter it below to assess yourself", gVerdictNoData: 'No data yet',
      detEma20: '20-day MA (EMA20)', detEma50: '50-day MA (EMA50)', detRsi: 'RSI (14)', detMacd: 'MACD histogram',
      detSupport: 'Latest support', detResistance: 'Latest resistance', detAdx: 'Trend strength (ADX 14)', detAdxStrong: ' · strong', detAdxWeak: ' · weak', detNoData: '—',
      alertStartPrice: "Enter a valid starting gold price (or wait for today's price to load first, then try again)", alertPmt: 'Enter a valid monthly savings amount',
      dcaContribSub: '{amt} baht/month × {months} months', dcaWeightAltGram: '≈ {v} baht-weight', dcaWeightAltBaht: '≈ {v} grams',
      yrTableColYear: 'End of year', yrTableColContrib: 'Contributed', yrTableColWeight: 'Accumulated weight', yrTableColValue: 'Value', yrRowLabel: 'Year {n}',
      unitGramShort: ' g', unitBahtGoldShort: ' bw',
      ddNearAth: 'The price is currently near its all-time high (dip {dd}%) — a normal saving of {base}/month is enough, no need to add extra',
      ddNormal: 'Down <b>{dd}%</b> from the all-time high — still considered normal, save as planned at {base}/month',
      ddTierMsg: 'Down <b>{dd}%</b> from the all-time high — per the rule you set, consider increasing this month\'s purchase to <b>×{mult}</b> ≈ <b>{amt}</b> (if you have reserve funds)',
      lgGroupSummaryGold: 'Total bought {amt} · {weight} baht-weight (≈ {gram} grams) · average cost {avg}/baht-weight',
      lgGroupValueNow: ' · current value {val} <b style="color:{color}">({sign}{pl}, {sign2}{pct}%)</b>',
      logThDate: 'Date', logThType: 'Type', logThPaid: 'Amount paid', logThPricePerUnit: 'Price/unit paid', logThWeight: 'Weight received',
      typeJewelryShort: 'Jewelry', typeBarShort: 'Bar',
      alertAmtPrice: 'Enter a valid amount paid and price/unit', chipFetchFail: '— could not fetch right now',
      alertGPriceUsd: 'Enter the current global gold price first', alertGHiLo: 'Enter the period high/low as well to assess',
      aiSumTitle: 'AI Gold Price Summary', aiSumBtn: 'Summarize It',
      needStockData: 'No price data to summarize yet — wait for the global gold price to load, or enter it manually and assess first',
      summarizing: 'Summarizing…', summarizeFail: 'Summary failed, try again', summarizeFailWith: 'Summary failed: {msg}',
      summarizeCached: 'Already summarized (loaded from cache — no new AI call needed)',
      ctxAsset: 'Asset: Gold (global price trend, USD/oz)', ctxLatestPrice: 'Latest price: {v} USD/oz', ctxVerdict: 'Computed signal: {v} ({why})',
      ctxPros: 'Detected tailwinds: {v}', ctxCons: 'Detected risks: {v}',
      ctxRsi: 'RSI (14-day): {v}', ctxRsiHigh: ' (high/overheated)', ctxRsiLow: ' (low/selling pressure easing)', ctxRsiMid: ' (neutral)',
      ctxMacd: 'MACD histogram: {v}', ctxMacdPos: ' (positive)', ctxMacdNeg: ' (negative)',
      ctxEma: '20-day MA: {e20}, 50-day MA: {e50}', ctxEmaUp: ' (price above the MAs — uptrend)', ctxEmaDn: ' (price below the MAs — downtrend/consolidation)',
      ctxSupport: 'Latest support: {v}', ctxResistance: 'Latest resistance: {v}',
      ctxAdx: 'Trend strength (ADX): {v}', ctxAdxStrong: ' (strong)', ctxAdxWeak: ' (weak)',
      rcTitle: 'If you buy, how much should you put in, and where should you sell',
      rcCapitalLabel: 'Total capital (THB)', rcCapitalPh: 'e.g. 300000',
      rcRiskPctLabel: 'Risk tolerance per purchase', rcUnitPctPortfolio: '(% of portfolio)',
      rcEntryLabel: 'Purchase price (THB/baht-weight)', rcEntryPh: "= today's gold bar price",
      rcStopLabel: 'Stop-loss price (THB/baht-weight)', rcStopPh: 'Auto-suggested',
      rcCalcBtn: 'Calculate',
      rcErrNeedEntry: "Enter the purchase price first (or wait for today's gold price to load)",
      rcErrStop: 'The stop-loss price must be below the purchase price',
      rcCapLimitedNote: 'Limited by available funds (capital is not enough to buy the full amount the risk setting would allow)',
      rcQtyLine: 'You could buy about <b>{qty} baht-weight of gold</b> using ≈ <b>{cost}</b>',
      rcKvIfWrong: 'If wrong (hits Stop), you lose no more than', rcKvStop: 'Stop-loss price (Stop)',
      rcKvRr: 'Reward:risk to resistance (approximated from the global gold trend)',
      checklistTitle: 'Pre-purchase check — should you buy?',
      chkSpotOnly: "Confirm you're buying real gold (bars/jewelry), not a futures contract/margin",
      ynYes: 'Yes', ynNo: 'Not yet', checkBtn: 'Check the checklist',
      chkTrendUp: 'In an uptrend (price above the moving average)', chkTrendDn: 'Not yet in an uptrend (price below the moving average)',
      chkAdxSuffix: ' · ADX {v} {label}', chkAdxStrong: 'strong trend', chkAdxWeak: 'weak trend, be careful',
      chkNoChase: 'Not chasing the price (within 5% of the 20-day average)', chkChasing: 'Chasing the price (more than 5% above the 20-day average)',
      chkTrendNeedData: 'Trend/price-chasing: needs the global gold price to load first',
      chkRsiOk: 'Not overheated (RSI {v})', chkRsiHot: 'Overheated (RSI {v} ≥ 70), risk of a pullback', chkRsiNeedData: 'RSI: needs the global gold price to load first',
      chkStopSet: 'Stop-loss (Stop) is set', chkStopUnset: 'Stop-loss not set yet — press "Calculate" above first',
      chkRiskOk: 'Risk per purchase ≤ 2% ({v}%)', chkRiskHigh: 'Risk per purchase is too high ({v}) — should be ≤ 2%',
      chkRrOk: 'Reward:risk ≥ 2:1 ({v}:1)', chkRrLow: 'Reward:risk too low ({v}:1) — should be ≥ 2:1',
      chkRrNeedData: 'Reward:risk: needs resistance from the chart + a Stop set first',
      chkSpotYes: 'Confirmed: buying real gold, not a futures contract/margin',
      chkSpotNo: 'Planning to use a futures contract/margin — risk of forced liquidation from short-term volatility; buying real gold is recommended instead',
      chkSpotUnknown: "Confirm first that you're buying real gold, not a futures contract/margin (press the button above)",
      checklistFail: 'Not ready to buy yet — {n} item(s) failed; fix them all before buying',
      checklistUnknown: 'Not enough information to fully assess — press "Calculate" above and answer the questions first',
      checklistGo: 'Ready to buy per plan — passed every item (still no profit guarantee — follow the plan and always cut losses)'
    }
  });
  var t = L.t;

  /* ── รหัสจาก InvestCalc → ข้อความ ── */
  var WHY_KEY = { cheapRange: 'whyCheapRange', expensiveRange: 'whyExpensiveRange', rsiLow: 'whyRsiLow', rsiHigh: 'whyRsiHigh', momUp: 'whyMomUp', momDn: 'whyMomDn',
    uptrend: 'whyUptrend', downtrend: 'whyDowntrend', bbLow: 'whyBbLow', bbHigh: 'whyBbHigh', neutral: 'whyNeutral' };
  function whyText(code, a) {
    if (code === 'cheapPct') return t('whyCheapPct', { pct: a.pct });
    if (code === 'expensivePct') return t('whyExpensivePct', { pct: a.pct });
    if (code === 'midPct') return t('whyMidPct', { pct: a.pct });
    return t(WHY_KEY[code] || 'whyNeutral');
  }
  /* a = ผลของ Calc.analyzeSeries/analyzeSimple (รหัส) → ใส่ข้อความที่หน้าอ่าน (verdict/why/prosT/consT) */
  function decorate(a) {
    a.verdict = t(a.light === 'green' ? 'vInterestingGold' : a.light === 'red' ? 'vCarefulGold' : 'vMidGold');
    a.whyCode = a.why;
    a.why = whyText(a.whyCode, a);
    a.prosT = (a.pros || []).map(function (c) { return whyText(c, a); });
    a.consT = (a.cons || []).map(function (c) { return whyText(c, a); });
    return a;
  }

  /* ── ราคาทองไทย (InvestCore.thaiGold) ── */
  function setGoldThStatus(msg, cls) { var el = $('goldThStatus'); el.textContent = msg; el.className = 'status' + (cls ? ' ' + cls : ''); }
  function fillGoldThFields(o) {
    $('barBuy').value = o.barBuyPrice.toFixed(2);
    $('barSell').value = o.barSellPrice.toFixed(2);
    $('jewelryBuy').value = o.jewelryBuyPrice.toFixed(2);
    $('jewelrySell').value = o.jewelrySellPrice.toFixed(2);
    if (!$('dcaStart').value) $('dcaStart').value = o.barBuyPrice.toFixed(2);
    if (!$('gdNow').value) $('gdNow').value = o.barBuyPrice.toFixed(2);
    if (!$('rcEntry').value) $('rcEntry').value = o.barBuyPrice.toFixed(2);
    if ($('dcaOut').style.display === 'none') doDCA(true);
    renderGoldLog();
  }
  function onManualPriceInput() {
    var b1 = num($('barBuy').value), b2 = num($('barSell').value), j1 = num($('jewelryBuy').value), j2 = num($('jewelrySell').value);
    var badge = $('goldThBadge'); badge.style.display = 'inline-block'; badge.className = 'badge wrap';
    if (![b1, b2, j1, j2].every(isFinite)) { badge.textContent = t('badgeManualText'); setGoldThStatus(t('manualEnterAll')); return; }
    badge.textContent = t('badgeManualUsedText');
    setGoldThStatus(t('manualUsedStatus'), 'ok');
    if (!$('dcaStart').value) $('dcaStart').value = b1.toFixed(2);
    if (!$('gdNow').value) $('gdNow').value = b1.toFixed(2);
    if ($('dcaOut').style.display === 'none') doDCA(true);
    renderGoldLog();
  }
  function runThaiFetch(force) {
    setGoldThStatus(t('goldThFetching'));
    $('goldThBadge').style.display = 'none';
    IC.thaiGold({ force: !!force }).then(function (o) {
      fillGoldThFields(o);
      var badge = $('goldThBadge'); badge.style.display = 'inline-block'; badge.className = 'badge wrap ok';
      if (o.stale) {
        badge.textContent = t('badgeStaleCache', { age: IC.ago(o.ts) });
        setGoldThStatus(t('statusStaleCache'), 'ok');
      } else {
        badge.textContent = t('badgeRealLive') + (o.updateDate ? t('badgeRealLiveUpdated', { date: o.updateDate, time: o.updateTime || '' }) : '');
        setGoldThStatus(t('fetchSuccess'), 'ok');
      }
    }, function () {
      var badge = $('goldThBadge'); badge.style.display = 'inline-block'; badge.className = 'badge wrap';
      badge.textContent = t('badgeManualText');
      setGoldThStatus(t('statusFetchFailNoCache'), 'err');
    });
  }

  /* ── ไฟจราจรจากราคาทองโลก (GC=F) ── */
  function setAiSumStatus(text, cls) { var el = $('aiSumStatus'); if (!el) return; el.textContent = text || ''; el.className = 'status' + (cls ? ' ' + cls : ''); }
  function showGoldVerdict(a, meta) {
    if (a) lastAnalysis = a;
    var el = $('gSrcBadge');
    if (meta.kind === 'real') {
      el.className = 'badge wrap ok';
      el.textContent = t('badgeIntlTrend') + (meta.stale ? t('badgeStaleSuffix', { age: IC.ago(meta.cachedAt) }) : '') + (meta.days ? t('badgeDaysSuffix', { days: meta.days }) : '');
    } else if (meta.kind === 'manual') { el.className = 'badge wrap'; el.textContent = t('badgeManualEval'); }
    else { el.className = 'badge wrap'; el.textContent = t('badgeFetchFail'); }
    if (!a) {
      $('gLight').className = 'light gray'; $('gBulb').textContent = ''; $('gBulb').style.background = 'var(--ome-text-3)';
      $('gVerdict').textContent = t('gVerdictNoData'); $('gWhy').textContent = '';
      $('gDetailsBox').style.display = 'none'; $('aiSumCard').style.display = 'none';
      return;
    }
    var bulbColors = { green: 'var(--ome-ok)', yellow: 'var(--ome-warn)', red: 'var(--ome-err)' };
    $('gLight').className = 'light ' + a.light;
    $('gBulb').textContent = ''; $('gBulb').style.background = bulbColors[a.light] || 'var(--ome-text-3)';
    $('gVerdict').textContent = a.verdict; $('gWhy').textContent = a.why;
    if (a.det && !a.simple && isFinite(a.det.rsi)) {
      var d = a.det, rows = [
        [t('detEma20'), fmt(d.ema20) + ' USD'], [t('detEma50'), fmt(d.ema50) + ' USD'],
        [t('detRsi'), fmt(d.rsi, 1)], [t('detMacd'), fmt(d.macdHist, 3)],
        [t('detSupport'), fmt(d.support) + ' USD'], [t('detResistance'), fmt(d.resistance) + ' USD'],
        [t('detAdx'), isFinite(d.adx) ? fmt(d.adx, 0) + (d.adx >= 20 ? t('detAdxStrong') : t('detAdxWeak')) : t('detNoData')]
      ], html = '';
      rows.forEach(function (r) { html += '<div class="k">' + esc(r[0]) + '</div><div class="v">' + esc(r[1]) + '</div>'; });
      $('gDetKv').innerHTML = html; $('gDetailsBox').style.display = 'block';
    } else { $('gDetailsBox').style.display = 'none'; }
    $('aiSumCard').style.display = 'block';
    $('aiSumOut').style.display = 'none'; $('aiSumOut').textContent = ''; setAiSumStatus('', '');
  }
  var lastIntl = null;
  function runIntlAnalysis() {
    IC.series('GC=F').then(function (r) {
      lastIntl = r;
      lastVerdictMode = 'real';
      showGoldVerdict(decorate(Calc.analyzeSeries(r.series, { psar: false })), { kind: 'real', stale: r.stale, cachedAt: r.cachedAt, days: r.series.closes.length });
      $('gManualWrap').style.display = 'none';
    }, function () {
      lastIntl = null;
      showGoldVerdict(null, { kind: 'fail' });
      $('gManualWrap').style.display = 'block';
    });
  }

  /* ── ถ้าจะซื้อ ควรใส่เงินเท่าไร (บาท/บาททองคำ) ── */
  function doCalc() {
    var capital = num($('rcCapital').value), riskPct = num($('rcRiskPct').value);
    var entry = num($('rcEntry').value), stop = num($('rcStop').value);
    $('rcResult').style.display = 'block';
    if (!isFinite(entry)) { $('rcHeadline').innerHTML = '<span style="color:var(--ome-err-ink)">' + esc(t('rcErrNeedEntry')) + '</span>'; $('rcKv').innerHTML = ''; return; }
    if (!isFinite(stop)) {
      stop = (lastAnalysis && isFinite(lastAnalysis.suggestStop) && isFinite(lastAnalysis.price) && lastAnalysis.price > 0) ? entry * (lastAnalysis.suggestStop / lastAnalysis.price) : entry * 0.95;
      $('rcStop').value = stop.toFixed(2);
    }
    if (!isFinite(capital) || capital <= 0) { capital = 300000; $('rcCapital').value = capital; }
    if (!isFinite(riskPct) || riskPct <= 0) { riskPct = 2; $('rcRiskPct').value = riskPct; }
    var res = Calc.riskCalc.gold({ capital: capital, riskPct: riskPct, entry: entry, stop: stop,
      usdPrice: lastAnalysis ? lastAnalysis.price : NaN, usdResistance: lastAnalysis ? lastAnalysis.resistance : NaN });
    if (res.error) { $('rcHeadline').innerHTML = '<span style="color:var(--ome-err-ink)">' + esc(t('rcErrStop')) + '</span>'; $('rcKv').innerHTML = ''; return; }
    $('rcHeadline').innerHTML = t('rcQtyLine', { qty: fmt(res.qty, 4), cost: baht(res.cost) });
    var kv = '<div class="k">' + esc(t('rcKvIfWrong')) + '</div><div class="v">' + baht(res.riskBaht) + '</div>';
    kv += '<div class="k">' + esc(t('rcKvStop')) + '</div><div class="v">' + fmt(stop) + '</div>';
    if (isFinite(res.rr)) kv += '<div class="k">' + esc(t('rcKvRr')) + '</div><div class="v">' + fmt(res.rr, 1) + ' : 1</div>';
    if (res.note) kv += '<div class="k" style="color:var(--ome-warn-ink)">' + esc(t('rcKvNote')) + '</div><div class="v" style="color:var(--ome-warn-ink);font-size:var(--ome-fs-xs)">' + esc(t('rcCapLimitedNote')) + '</div>';
    $('rcKv').innerHTML = kv;
  }

  /* ── เช็กลิสต์ก่อนซื้อ ── */
  var CHK_KEY = { trendUp: 'chkTrendUp', trendDn: 'chkTrendDn', noChase: 'chkNoChase', chasing: 'chkChasing', trendNeedData: 'chkTrendNeedData',
    rsiOk: 'chkRsiOk', rsiHot: 'chkRsiHot', rsiNeedData: 'chkRsiNeedData', stopSet: 'chkStopSet', stopUnset: 'chkStopUnset', riskOk: 'chkRiskOk', riskHigh: 'chkRiskHigh',
    rrOk: 'chkRrOk', rrLow: 'chkRrLow', rrNeedData: 'chkRrNeedData', spotYes: 'chkSpotYes', spotNo: 'chkSpotNo', spotUnknown: 'chkSpotUnknown' };
  function chkText(c) {
    var v = c.vars || {}, txt = t(CHK_KEY[c.code], { v: v.v });
    if ((c.code === 'trendUp' || c.code === 'trendDn') && isFinite(v.adx)) txt += t('chkAdxSuffix', { v: Number(v.adx).toFixed(0), label: v.adxStrong ? t('chkAdxStrong') : t('chkAdxWeak') });
    return txt;
  }
  function doChecklist() {
    var checks = Calc.checklist.gold({ a: lastAnalysis && lastAnalysis.det ? lastAnalysis : null, entry: num($('rcEntry').value), stop: num($('rcStop').value), riskPct: num($('rcRiskPct').value), answer: gAnswers.spotOnly });
    var v = Calc.checklistVerdict(checks), el = $('checkVerdict');
    if (v.verdict === 'fail') { el.className = 'callout err'; el.textContent = t('checklistFail', { n: v.fails }); }
    else if (v.verdict === 'unknown') { el.className = 'callout warn'; el.textContent = t('checklistUnknown'); }
    else { el.className = 'callout ok'; el.textContent = t('checklistGo'); }
    IC.renderChecklist($('chkList'), checks, chkText);
    $('checkResult').style.display = 'block';
  }

  /* ── สรุปด้วย AI (คลาวด์อย่างเดียว — task 'stock:gold') ── */
  var AI_SUMMARY_SYSTEM_PROMPT = 'คุณเป็นผู้ช่วยสรุปข้อมูลราคาทองคำให้นักลงทุนมือใหม่ชาวไทยฟัง จะได้รับตัวเลข/' +
    'สัญญาณทางเทคนิคที่คำนวณไว้ให้แล้วล่วงหน้า (ห้ามคำนวณหรือเดาตัวเลขเพิ่มเองเด็ดขาด ใช้เฉพาะตัวเลขที่ให้มา) ' +
    'หน้าที่ของคุณคือเรียบเรียงเป็นภาษาพูดที่เข้าใจง่าย ไม่ใช่ผู้แนะนำการลงทุน ' +
    'ตอบเป็นภาษาไทยตามโครงสร้างนี้เท่านั้น (ห้ามขึ้นต้นด้วยคำนำ ให้เริ่มที่ "สรุปภาพรวม:" ทันที):\n\n' +
    'สรุปภาพรวม: (1-2 ประโยค อธิบายสถานะราคาปัจจุบันแบบเข้าใจง่ายจากข้อมูลที่ให้)\n' +
    'ปัจจัยหนุน: (ไม่เกิน 3 ข้อ จากข้อมูลที่ให้เท่านั้น ถ้าไม่มีให้บอกว่า "ไม่มีปัจจัยหนุนเด่นชัดตอนนี้")\n' +
    'ปัจจัยเสี่ยง: (ไม่เกิน 3 ข้อ จากข้อมูลที่ให้เท่านั้น ถ้าไม่มีให้บอกว่า "ไม่มีปัจจัยเสี่ยงเด่นชัดตอนนี้")\n\n' +
    'ห้ามให้คำแนะนำซื้อ/ขาย ห้ามทำนายราคาในอนาคต ห้ามเติมตัวเลขหรือเหตุการณ์ที่ไม่ได้อยู่ในข้อมูลที่ให้มาเด็ดขาด';
  var AI_SUMMARY_REMINDER = 'ย้ำ: ห้ามให้คำแนะนำซื้อ/ขาย ห้ามทำนายราคาในอนาคต ห้ามเติมตัวเลข/เหตุการณ์ที่ไม่ได้อยู่ในข้อมูลที่ให้มา ' +
    'ตอบตามโครงสร้าง 3 หัวข้อที่กำหนดเท่านั้น เริ่มที่ "สรุปภาพรวม:" ทันที ห้ามขึ้นต้นด้วยคำนำ';
  var AI_SUMMARY_SYSTEM_PROMPT_EN = 'You are an assistant who summarizes gold price data for a novice retail investor. You will be given ' +
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
    var a = lastAnalysis; if (!a) return null;
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
    var ctx = buildAiSumContext();
    if (!ctx) { setAiSumStatus(t('needStockData'), 'err'); return; }
    aiBusy = true; $('aiSumBtn').disabled = true; $('aiSumOut').style.display = 'none'; $('aiSumOut').textContent = '';
    setAiSumStatus(t('summarizing'), '');
    var en = IC.getLang() === 'en', cached = false;
    IC.summarize({ task: 'stock:gold', onResult: function (r) { cached = !!(r && r.cached); }, messages: [
      { role: 'system', content: en ? AI_SUMMARY_SYSTEM_PROMPT_EN : AI_SUMMARY_SYSTEM_PROMPT },
      { role: 'user', content: ctx },
      { role: 'system', content: en ? AI_SUMMARY_REMINDER_EN : AI_SUMMARY_REMINDER }
    ] }).then(function (text) {
      if (!text) setAiSumStatus(t('summarizeFail'), 'err');
      else { $('aiSumOut').style.display = 'block'; $('aiSumOut').textContent = text; setAiSumStatus(cached ? t('summarizeCached') : '', cached ? 'ok' : ''); }
    }, function (err) { setAiSumStatus(t('summarizeFailWith', { msg: IC.aiMessage(err) }), 'err'); })
      .then(function () { aiBusy = false; $('aiSumBtn').disabled = false; });
  }

  /* ── วางแผนออมทอง (DCA) ── */
  var lastGoldChart = null;
  function drawGoldChart(r) {
    lastGoldChart = r;
    var s = r.series, W = 640, H = 220, pad = 8, n = s.length, val = [], con = [], i;
    if (!n) return;
    for (i = 0; i < n; i++) { val.push(s[i].value); con.push(s[i].contrib); }
    var max = Math.max(val[n - 1], con[n - 1]) || 1;
    var x = function (k) { return pad + k / Math.max(1, n - 1) * (W - 2 * pad); };
    var y = function (v) { return pad + (1 - v / max) * (H - 2 * pad); };
    function path(a) { var d = '', k; for (k = 0; k < a.length; k++) d += (k ? 'L' : 'M') + x(k).toFixed(1) + ' ' + y(a[k]).toFixed(1) + ' '; return d; }
    var area = path(val) + 'L' + x(n - 1).toFixed(1) + ' ' + y(0).toFixed(1) + ' L' + x(0).toFixed(1) + ' ' + y(0).toFixed(1) + ' Z';
    var C = window.OmeChartTheme.get(), svg = '';
    svg += '<path d="' + area + '" fill="' + C.series[3] + '" opacity="0.12"/>';
    svg += '<path d="' + path(con) + '" fill="none" stroke="' + C.axis + '" stroke-width="1.6" stroke-dasharray="5 3"/>';
    svg += '<path d="' + path(val) + '" fill="none" stroke="' + C.series[3] + '" stroke-width="2.4" stroke-linejoin="round"/>';
    $('dcaChart').innerHTML = svg;
  }
  function dcaYearTable(r, unit) {
    var html = '<div class="table-wrap"><table class="table right"><thead><tr><th>' + esc(t('yrTableColYear')) + '</th><th>' + esc(t('yrTableColContrib')) + '</th><th>' + esc(t('yrTableColWeight')) + '</th><th>' + esc(t('yrTableColValue')) + '</th></tr></thead><tbody>';
    var yrs = Math.round(r.series.length / 12), i;
    for (i = 1; i <= yrs; i++) {
      var idx = i * 12 - 1; if (idx >= r.series.length) break;
      var row = r.series[idx], w = unit === 'gram' ? row.weight * GRAM.bar : row.weight;
      html += '<tr><td>' + esc(t('yrRowLabel', { n: i })) + '</td><td>' + baht(row.contrib) + '</td><td>' + fmt(w, 4) + esc(unit === 'gram' ? t('unitGramShort') : t('unitBahtGoldShort')) + '</td><td>' + baht(row.value) + '</td></tr>';
    }
    return html + '</tbody></table></div>';
  }
  function doDCA(silent) {
    var pmt = num($('dcaPmt').value) || 0, startPrice = num($('dcaStart').value), years = num($('dcaYears').value) || 10, cagr = num($('dcaCagr').value), unit = $('dcaUnit').value;
    if (!isFinite(cagr)) { cagr = 5; $('dcaCagr').value = 5; }
    if (!isFinite(startPrice) || startPrice <= 0) { if (!silent) alert(t('alertStartPrice')); return; }
    if (pmt <= 0) { if (!silent) alert(t('alertPmt')); return; }
    var months = Math.round(years * 12), r = Calc.simulateDCA(pmt, startPrice, cagr, months);
    $('dcaOut').style.display = 'block';
    var weightDisplay = unit === 'gram' ? r.weight * GRAM.bar : r.weight;
    $('dcaContrib').textContent = baht(r.contrib);
    $('dcaContribSub').textContent = t('dcaContribSub', { amt: fmt0(pmt), months: months });
    $('dcaWeight').textContent = fmt(weightDisplay, 4) + ' ' + t(unit === 'gram' ? 'unitGram' : 'unitBahtGold').toLowerCase();
    $('dcaWeightSub').textContent = unit === 'gram' ? t('dcaWeightAltGram', { v: fmt(r.weight, 4) }) : t('dcaWeightAltBaht', { v: fmt(r.weight * GRAM.bar, 2) });
    $('dcaValue').textContent = baht(r.value);
    $('dcaGain').textContent = (r.value - r.contrib >= 0 ? '+' : '') + baht(r.value - r.contrib);
    drawGoldChart(r);
    $('dcaYrTable').innerHTML = dcaYearTable(r, unit);
    lastGoldPlan = { pmt: pmt };
  }

  /* ── ตลาดย่อ = โอกาสเติมทอง ── */
  function doGoldDrawdown() {
    var out = $('gdOut');
    [].forEach.call(document.querySelectorAll('#gdTranche .tr-box'), function (b) { b.classList.remove('on'); });
    var r = Calc.drawdown(num($('gdNow').value), num($('gdAth').value));
    if (!r) { out.style.display = 'none'; return; }
    var base = lastGoldPlan.pmt || 3000, msg;
    if (r.tier) document.querySelector('#gdTranche .tr-box[data-dd="' + r.tier.dd + '"]').classList.add('on');
    if (r.zone === 'nearAth') msg = t('ddNearAth', { dd: fmt(Math.max(0, r.dd), 1), base: baht(base) });
    else if (r.zone === 'normal') msg = t('ddNormal', { dd: fmt(r.dd, 1), base: baht(base) });
    else msg = t('ddTierMsg', { dd: fmt(r.dd, 1), mult: r.mult, amt: baht(base * r.mult) });
    out.innerHTML = msg; out.style.display = 'block';
  }

  /* ── สมุดทองของฉัน (อ่านสด → แก้ → เขียน · ลบด้วย ts) ── */
  function loadGoldLog() { var a = IC.lsJson(LOG_KEY); return Array.isArray(a) ? a : []; }
  function editGoldLog(fn) { var a = loadGoldLog(); fn(a); IC.lsSet(LOG_KEY, a); }
  function renderGoldLog() {
    var log = loadGoldLog(), box = $('lgBox');
    if (!log.length) { box.innerHTML = '<div class="log-empty">' + esc(t('lgEmptyDefault')) + '</div>'; return; }
    /* ราคารับซื้อ (ที่คุณได้รับ) ของแต่ละชนิดจากช่องราคาด้านบน */
    var sell = { bar: num($('barSell').value), jewelry: num($('jewelrySell').value) };
    var groups = { bar: { label: t('typeBar'), amt: 0, weight: 0 }, jewelry: { label: t('typeJewelry'), amt: 0, weight: 0 } };
    log.forEach(function (r) {
      var key = r.type === 'jewelry' ? 'jewelry' : 'bar', g = groups[key];
      g.amt += +r.amt || 0; g.weight += toBahtWeight(+r.weight || 0, r.unit, key);
    });
    var html = '';
    ['bar', 'jewelry'].forEach(function (key) {
      var g = groups[key]; if (g.weight <= 0) return;
      var avg = g.amt / g.weight;
      html += '<div class="log-group-hd">' + esc(g.label) + '</div>';
      html += '<div class="log-group-sub">' + esc(t('lgGroupSummaryGold', { amt: baht(g.amt), weight: fmt(g.weight, 4), gram: fmt(g.weight * GRAM[key], 2), avg: baht(avg) }));
      if (isFinite(sell[key])) {
        var val = g.weight * sell[key], pl = val - g.amt, pct = g.amt > 0 ? pl / g.amt * 100 : 0;
        html += t('lgGroupValueNow', { val: baht(val), color: pl >= 0 ? 'var(--ome-ok-ink)' : 'var(--ome-err-ink)', sign: pl >= 0 ? '+' : '−', pl: baht(Math.abs(pl)), sign2: pct >= 0 ? '+' : '', pct: fmt(pct, 1) });
      }
      html += '</div>';
    });
    html += '<div class="table-wrap"><table class="table right"><thead><tr><th>' + esc(t('logThDate')) + '</th><th>' + esc(t('logThType')) + '</th><th>' + esc(t('logThPaid')) + '</th><th>' + esc(t('logThPricePerUnit')) + '</th><th>' + esc(t('logThWeight')) + '</th><th></th></tr></thead><tbody>';
    log.forEach(function (r) {
      html += '<tr><td>' + new Date(r.ts).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) + '</td>' +
        '<td>' + esc(r.type === 'jewelry' ? t('typeJewelryShort') : t('typeBarShort')) + '</td><td>' + baht(r.amt) + '</td><td>' + fmt(r.price, 2) + '</td>' +
        '<td>' + fmt(r.weight, 4) + esc(r.unit === 'gram' ? t('unitGramShort') : t('unitBahtGoldShort')) + '</td>' +
        '<td><button class="btn sm ghost icon log-del" type="button" aria-label="' + esc(t('delTitle')) + '" data-ts="' + esc(r.ts) + '"><svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-x"/></svg></button></td></tr>';
    });
    box.innerHTML = html + '</tbody></table></div>';
  }
  function addGoldLog() {
    var type = $('lgType').value, unit = $('lgUnit').value, amt = num($('lgAmt').value), price = num($('lgPrice').value);
    if (!isFinite(amt) || amt <= 0 || !isFinite(price) || price <= 0) { alert(t('alertAmtPrice')); return; }
    editGoldLog(function (a) {
      var ts = Date.now(); while (a.some(function (r) { return r && r.ts === ts; })) ts++;
      a.push({ type: type, unit: unit, amt: amt, price: price, weight: amt / price, ts: ts });
    });
    $('lgAmt').value = ''; $('lgPrice').value = '';
    renderGoldLog();
  }

  /* ── ปัจจัยราคาทอง: DXY / ดอกเบี้ย 10 ปีสหรัฐฯ (quote ย่อ — แคช cache:q:*) ── */
  function renderFactorChip(id, sym) {
    var el = $(id);
    IC.quote(sym).then(function (q) {
      var pct = isFinite(q.prev) && q.prev ? (q.price / q.prev - 1) * 100 : NaN;
      el.textContent = fmt(q.price, 2) + (isFinite(pct) ? ' (' + (pct >= 0 ? '+' : '') + fmt(pct, 2) + '%)' : '');
    }, function () { el.textContent = t('chipFetchFail'); });
  }

  /* ── เริ่มแท็บทองครั้งแรกที่เปิด ── */
  function initGold() {
    if (inited) return; inited = true;
    ['barBuy', 'barSell', 'jewelryBuy', 'jewelrySell'].forEach(function (id) { $(id).addEventListener('input', onManualPriceInput); });
    $('goldThRefresh').addEventListener('click', function () { runThaiFetch(true); });
    $('gManualBtn').addEventListener('click', function () {
      var price = num($('gPriceUsd').value), hi = num($('gHiUsd').value), lo = num($('gLoUsd').value);
      if (!isFinite(price)) { alert(t('alertGPriceUsd')); return; }
      if (!isFinite(hi) || !isFinite(lo) || hi <= lo) { alert(t('alertGHiLo')); return; }
      lastVerdictMode = 'manual';
      showGoldVerdict(decorate(Calc.analyzeSimple(price, hi, lo)), { kind: 'manual' });
    });
    $('dcaBtn').addEventListener('click', function () { doDCA(false); });
    $('gdBtn').addEventListener('click', doGoldDrawdown);
    $('lgAdd').addEventListener('click', addGoldLog);
    $('lgBox').addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.log-del'); if (!b) return;
      var ts = +b.getAttribute('data-ts');
      editGoldLog(function (a) { for (var i = a.length - 1; i >= 0; i--) if (a[i] && a[i].ts === ts) a.splice(i, 1); });
      renderGoldLog();
    });
    $('rcCalcBtn').addEventListener('click', doCalc);
    $('chkForm').addEventListener('click', function (e) {
      var btn = e.target.closest('.yn-btn'); if (!btn) return;
      var row = btn.closest('.yn-row'), key = row.getAttribute('data-key'), val = btn.getAttribute('data-val');
      gAnswers[key] = val;
      [].forEach.call(row.querySelectorAll('.yn-btn'), function (b) { b.classList.remove('on', 'yes', 'no'); });
      btn.classList.add('on', val);
    });
    $('checkBtn').addEventListener('click', doChecklist);
    $('aiSumBtn').addEventListener('click', doAiSummary);
    window.OmeChartTheme.onChange(function () { if (lastGoldChart && $('dcaOut').style.display !== 'none') drawGoldChart(lastGoldChart); });
    if (window.TanotData && window.TanotData.onChange) window.TanotData.onChange(function () { renderGoldLog(); });
    renderGoldLog();
    runThaiFetch(false);
    runIntlAnalysis();
    renderFactorChip('dxyChip', 'DX-Y.NYB');
    renderFactorChip('tnxChip', '^TNX');
  }

  function syncHead() {
    $('crumbHere').textContent = t(curTab === 'markets' ? 'tabMarkets' : 'tabGold');
    $('pageTitle').textContent = t(curTab === 'markets' ? 'pageTitleMarkets' : 'pageTitle');
    document.title = t(curTab === 'markets' ? 'tabMarkets' : 'tabGold') + ' | Tanot';
  }
  function onTab(key, first) {
    curTab = key;
    $('panel-gold').hidden = key !== 'gold'; $('panel-markets').hidden = key !== 'markets';
    syncHead();
    if (key === 'gold') { initGold(); return; }
    /* invest-markets.js โหลดหลังไฟล์นี้ (defer ตามลำดับ) — รอจนทุกสคริปต์พร้อมก่อนเปิดแท็บ */
    var openLater = function () { if (curTab === 'markets' && window.InvestMarkets) window.InvestMarkets.init(); };
    if (document.readyState === 'complete') openLater(); else window.addEventListener('load', openLater);
  }

  tabsCtl = IC.tabs({ el: $('goldTabs'), page: 'gold', def: 'gold', t: t,
    tabs: [{ key: 'gold', labelKey: 'tabGold' }, { key: 'markets', labelKey: 'tabMarkets' }], onShow: onTab });
  IC.subnav($('ivSubRow'), 'gold');
  L.apply();
  IC.onLang(function () {
    L.apply(); IC.subnav($('ivSubRow'), 'gold'); tabsCtl.rerender(); syncHead();
    if (!inited) return;
    renderGoldLog();
    if (lastVerdictMode === 'manual') {
      var price = num($('gPriceUsd').value), hi = num($('gHiUsd').value), lo = num($('gLoUsd').value);
      if (isFinite(price) && isFinite(hi) && isFinite(lo) && hi > lo) showGoldVerdict(decorate(Calc.analyzeSimple(price, hi, lo)), { kind: 'manual' });
    } else if (lastIntl) {
      showGoldVerdict(decorate(Calc.analyzeSeries(lastIntl.series, { psar: false })), { kind: 'real', stale: lastIntl.stale, cachedAt: lastIntl.cachedAt, days: lastIntl.series.closes.length });
    }
    if ($('dcaOut').style.display !== 'none') doDCA(true);
    if ($('gdOut').style.display !== 'none') doGoldDrawdown();
    if ($('rcResult').style.display !== 'none') doCalc();
    if ($('checkResult').style.display !== 'none') doChecklist();
  });
})();
