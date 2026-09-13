/* ══════════════════════════════════════════════════════════════════
   Tanot — ทองคำ (ราคาวันนี้ + วางแผนออมทอง)
   • ราคาทองไทย (บาท/บาททองคำ) จาก thai-gold-api (community, MIT) best-effort หลายเส้นทาง
   • ไฟจราจร "ถูก/แพงตอนนี้ไหม" ประเมินจากแนวโน้มราคาทองโลก (GC=F) เป็นตัวแทนทิศทาง
   • วางแผนออมทอง (DCA) + เติมไม้ตอนราคาย่อ + สัดส่วนทองในพอร์ต
   • สมุดทองของฉัน (แท่ง/รูปพรรณ, บาททองคำ/กรัม) เก็บใน localStorage + สำรอง Google Drive
   • ปัจจัยที่มีผลต่อราคาทองคำ (ทางตรง/ทางอ้อม) — ตัวเลขสด 2 ตัว (DXY, ดอกเบี้ย 10 ปีสหรัฐฯ) ที่เหลือเป็นความรู้ทั่วไป
   หมายเหตุ: ตัวช่วยคิด ไม่ใช่คำแนะนำการลงทุน
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var LOG_KEY = 'tanot:invest:gold';
  var GRAM_PER_BAHT = 15.244;
  var lastGoldPlan = { pmt: 3000 };
  var lastVerdictMode = 'real';

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }
  function fmt(n, d) { d = d == null ? 2 : d; return isFinite(n) ? n.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'; }
  function fmt0(n) { return isFinite(n) ? Math.round(n).toLocaleString('th-TH') : '—'; }
  function baht(n) { if (!isFinite(n)) return '—'; var neg = n < 0; return (neg ? '−' : '') + '฿' + Math.round(Math.abs(n)).toLocaleString('th-TH'); }
  function toBahtWeight(w, unit) { return unit === 'gram' ? w / GRAM_PER_BAHT : w; }

  /* ══════ ระบบแปลภาษา (i18n) — รูปแบบเดียวกับหน้าอื่นในโซนลงทุน ══════ */
  var UI_LANG_KEY = 'ome:lang';
  function getUILang() { try { return localStorage.getItem(UI_LANG_KEY) === 'en' ? 'en' : 'th'; } catch (e) { return 'th'; } }
  var I18N = {
    th: {
      crumbHome: 'การลงทุน', crumbHere: 'ทองคำ',
      pageTitle: 'ทองคำ — ราคาวันนี้ + วางแผนออมทอง',
      priceTitle: 'ราคาทองวันนี้ (บาท/บาททองคำ)',
      barBuyLabel: 'ทองคำแท่ง — ราคาซื้อ', boughtUnit: '(คุณจ่าย)', barSellLabel: 'ทองคำแท่ง — ราคาขายคืน', receivedUnit: '(คุณได้รับ)',
      jewelryBuyLabel: 'ทองรูปพรรณ — ราคาซื้อ', jewelrySellLabel: 'ทองรูปพรรณ — ราคาขายคืน',
      goldThStatusDefault: 'กำลังดึงราคาทองวันนี้…', refreshPriceBtn: 'รีเฟรชราคา',
      priceHint: 'ราคาเป็น "บาท ต่อ บาททองคำ" (น้ำหนักทองคำแบบไทย ~15.244 กรัม) · ส่วนต่างซื้อ-ขายคืน (spread) ของทองรูปพรรณกว้างกว่าทองแท่งมาก เพราะรวมค่ากำเหน็จที่ไม่ได้คืนตอนขาย',
      verdictTitle: 'ถูก/แพงตอนนี้ไหม',
      verdictDesc: 'ประเมินจาก<b>แนวโน้มราคาทองคำโลก (GC=F, USD/ออนซ์)</b> เป็นตัวแทนทิศทาง — ราคาไทยด้านบนคือราคาที่ซื้อขายจริง เคลื่อนไปทางเดียวกันแต่ตัวเลขต่างกันเพราะค่าเงินบาท + พรีเมียมนำเข้า ไม่ใช่คำแนะนำการลงทุน',
      gSrcBadgeDefault: 'กำลังตรวจแนวโน้ม…', gVerdictLoadingDefault: 'กำลังโหลด…', chipLoadingDefault: 'กำลังโหลด…',
      techDetailsSummary: 'ดูรายละเอียดทางเทคนิค (USD/ออนซ์ ไม่ต้องเข้าใจก็ได้)',
      manualHint: 'ดึงแนวโน้มอัตโนมัติไม่ได้ตอนนี้ — กรอกเองเพื่อประเมิน (ราคาทองโลกหาได้จากเว็บ/แอปข่าวการเงินทั่วไป)',
      gPriceUsdLabel: 'ราคาทองโลกตอนนี้', unitUsdOz: '(USD/ออนซ์)', gHiUsdLabel: 'สูงสุดของรอบ', gLoUsdLabel: 'ต่ำสุดของรอบ', manualEvalBtn: 'ประเมินจากราคานี้',
      dcaTitle: 'วางแผนออมทอง (DCA)', dcaDesc: 'ทยอยซื้อทองจำนวนเงินเท่าเดิมทุกเดือน ไม่ต้องเดาจังหวะตลาด — เหมาะกับการถือทองเป็นตัวช่วยกระจายความเสี่ยงระยะยาว',
      dcaPmtLabel: 'ออมเดือนละ', unitBaht: '(บาท)', dcaUnitLabel: 'หน่วยที่แสดงผล', unitBahtGold: 'บาททองคำ', unitGram: 'กรัม',
      dcaYearsLabel: 'วางแผนล่วงหน้า', unitYears: '(ปี)', dcaStartLabel: 'ราคาทองเริ่มต้น', unitBahtPerBahtGold: '(บาท/บาททองคำ)', dcaStartPh: 'รอราคาวันนี้โหลด…',
      dcaCagrLabel: 'สมมติราคาทองโตเฉลี่ย', unitPctYear: '(%/ปี)', calcPlanBtn: 'คำนวณแผน',
      dcaContribLabel: 'เงินที่ลงทั้งหมด', dcaWeightLabel: 'น้ำหนักทองที่สะสมได้', dcaValueLabel: 'มูลค่าประมาณสิ้นแผน', dcaGainLabel: 'กำไรจากราคาที่เปลี่ยน',
      chartValue: 'มูลค่ารวม', chartCost: 'เงินที่ใส่ (ต้นทุน)', viewYearTableSummary: 'ดูตารางรายปี',
      ddTitle: 'ตลาดย่อ = โอกาสเติมทอง (ทางเลือก)', gdNowLabel: 'ราคาทองตอนนี้', gdNowPh: 'เติมจากราคาวันนี้อัตโนมัติ',
      gdAthLabel: 'จุดสูงสุดที่เคยเห็น (ATH)', gdAthPh: 'กรอกเอง', ddBtn: 'ดูคำแนะนำ',
      tr10m: 'ย่อเล็ก', tr20m: 'ย่อแรง', tr30m: 'ย่อหนักมาก',
      ddHint: 'แนวคิด: ราคาย่อ = ได้ของถูกลง ถ้ามีเงินสำรองค่อยเพิ่มเงินซื้อตามระดับที่ตั้งไว้ล่วงหน้า (ไม่ใช่การทำนายว่าจะลงอีกไหม) · ATH ต้องกรอกเอง เพราะราคาทองไทยไม่มีข้อมูลย้อนหลังจากแหล่งฟรี',
      allocTitle: 'สัดส่วนทองในพอร์ต', allocDesc: 'แนวทางทั่วไปที่มักถูกพูดถึง (ไม่ใช่กฎตายตัว): ถือทอง ~5–10% ของพอร์ตรวม เป็นตัวช่วยกระจายความเสี่ยง ไม่ใช่สินทรัพย์หลัก เพราะทองไม่ให้ปันผล/ดอกเบี้ย',
      alPortfolioLabel: 'มูลค่าพอร์ตรวมโดยประมาณ', alPortfolioPh: 'เช่น 300000', alGoldNowLabel: 'มูลค่าทองที่ถืออยู่ตอนนี้', alGoldNowPh: 'เติมจากสมุดทองอัตโนมัติ', alBtn: 'คำนวณสัดส่วน',
      driveTitle: 'สำรองสมุดทองขึ้น Google Drive',
      driveDesc: 'เชื่อมต่อครั้งเดียว จากนั้นสมุดทองด้านล่างจะซิงก์ขึ้น Drive ให้อัตโนมัติทุกครั้งที่มีการเปลี่ยนแปลง (ไฟล์ในโฟลเดอร์ "OME_Progress" ของคุณเอง — คนละไฟล์กับหน้าหุ้น ไม่ปนกัน)',
      driveConnectBtn: 'เชื่อมต่อ Google Drive', driveConnectedBtn: 'เชื่อมต่อ Google Drive แล้ว',
      logTitle: 'สมุดทองของฉัน', logDesc: 'บันทึกทุกครั้งที่ซื้อ จะได้รู้ต้นทุนเฉลี่ยและมูลค่าปัจจุบัน (เก็บในเครื่องคุณ + สำรองขึ้น Drive อัตโนมัติถ้าเชื่อมต่อด้านบน)',
      lgTypeLabel: 'ชนิด', typeBar: 'ทองคำแท่ง', typeJewelry: 'ทองรูปพรรณ', lgUnitLabel: 'หน่วย',
      lgAmtLabel: 'เงินที่จ่าย', lgAmtPh: 'เช่น 35000', lgPriceLabel: 'ราคา/หน่วยที่ซื้อ', lgPricePh: 'เช่น 70950', lgAddBtn: '+ เพิ่ม',
      lgEmptyDefault: 'ยังไม่มีรายการ — บันทึกทุกครั้งที่ซื้อ จะได้รู้ต้นทุนเฉลี่ยและมูลค่าปัจจุบัน',
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
      factNote: 'หมายเหตุ: ตัวเลขจริงบางตัว (อัตราดอกเบี้ยที่แท้จริง/TIPS, ข้อมูลซื้อทองของธนาคารกลาง, คาดการณ์เงินเฟ้อ) ไม่มี API ฟรีที่ดึงจากเบราว์เซอร์ได้ตรงๆ — ส่วนนี้จึงเป็นข้อมูลความรู้ทั่วไป ไม่ใช่ตัวเลขสด ต่างจาก 2 รายการด้านบนที่มีชิปตัวเลขกำกับ',
      ageJustNow: 'เมื่อสักครู่', ageMinsAgo: '{n} นาทีก่อน', ageHrsAgo: '{n} ชม.ก่อน', ageDaysAgo: '{n} วันก่อน',
      whyCheapRange: 'ราคาอยู่ช่วงถูกเทียบ 3 เดือน', whyExpensiveRange: 'ราคาอยู่ช่วงแพงเทียบ 3 เดือน',
      whyRsiLow: 'แรงขายเริ่มคลาย (RSI ต่ำ กำลังฟื้น)', whyRsiHigh: 'ราคาร้อนแรงเกินไป (RSI สูง เสี่ยงย่อ)',
      whyMomUp: 'โมเมนตัมเริ่มกลับเป็นบวก', whyMomDn: 'โมเมนตัมเริ่มอ่อนลง',
      whyUptrend: 'ยังอยู่ในแนวโน้มขึ้น', whyDowntrend: 'อยู่ใต้เส้นแนวโน้ม (ขาลง/พักตัว)',
      whyBbLow: 'ราคาแตะกรอบล่าง (มักเป็นจังหวะเด้ง)', whyBbHigh: 'ราคาชนกรอบบน', whyNeutral: 'ราคาอยู่กลางกรอบ ยังไม่มีสัญญาณชัด',
      vInterestingGold: 'น่าสนใจ — ราคาทองอยู่ในโซนถูกเทียบแนวโน้ม', vCarefulGold: 'ระวัง — ราคาทองแพงเทียบแนวโน้ม', vMidGold: 'กลางๆ — ยังไม่มีจังหวะเด่น',
      whyCheapPct: 'ราคาอยู่ค่อนไปทางถูกของรอบ (~{pct}% ของช่วง ต่ำ→สูง)', whyExpensivePct: 'ราคาอยู่ค่อนไปทางแพงของรอบ (~{pct}% ของช่วง ต่ำ→สูง)', whyMidPct: 'ราคาอยู่กลางกรอบ (~{pct}% ของช่วง ต่ำ→สูง)',
      goldThFetching: 'กำลังดึงราคาทองวันนี้…', manualEnterAll: 'กำลังกรอกราคาเอง… กรอกให้ครบทั้ง 4 ช่องเพื่อใช้งาน',
      badgeManualText: 'กรอกเอง', manualUsedStatus: 'ใช้ราคาที่กรอกเองแล้ว', badgeManualUsedText: 'ใช้ราคาที่กรอกเอง',
      fetchSuccess: 'ดึงราคาสำเร็จ', fetchRetrying: 'ดึงราคาไม่สำเร็จ กำลังลองอีกครั้ง… ({n}/{total})',
      badgeRealLive: 'ราคาสด', badgeRealLiveUpdated: ' · ปรับปรุง {date} {time}',
      badgeStaleCache: 'ดึงสดไม่ได้ — ใช้ราคาที่บันทึกไว้ ({age})', statusStaleCache: 'ดึงสดไม่ได้ตอนนี้ (ลองแล้ว {n} ครั้ง) — ใช้ราคาที่บันทึกไว้',
      statusFetchFailNoCache: 'ดึงราคาทองอัตโนมัติไม่ได้ตอนนี้ (ลองแล้ว {n} ครั้ง) — กรอกเองในช่องด้านบน หรือลองรีเฟรชอีกครั้ง',
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
      ddWarn: 'เตือน: การย่อไม่ได้แปลว่าจะไม่ลงต่อ — เติมเท่าที่มีเงินสำรองและไม่กระทบชีวิตประจำวัน',
      alertPortfolio: 'กรอกมูลค่าพอร์ตรวมโดยประมาณก่อน',
      allocLow: 'สัดส่วนทอง ≈ {pct}% ของพอร์ต — ต่ำกว่ากรอบทั่วไปที่มักพูดถึง (5–10%) หากอยากมีทองไว้กระจายความเสี่ยงมากขึ้น ค่อยๆ เพิ่มได้',
      allocGood: 'สัดส่วนทอง ≈ {pct}% ของพอร์ต — อยู่ในกรอบที่นักลงทุนมือใหม่มักใช้เป็นแนวทาง (5–10%)',
      allocHigh: 'สัดส่วนทอง ≈ {pct}% ของพอร์ต — สูงกว่ากรอบทั่วไป ทองไม่ให้ปันผล/ดอกเบี้ย ถือมากไปอาจฉุดผลตอบแทนระยะยาวของพอร์ตโดยรวม',
      allocNote: 'ตัวเลข 5–10% เป็นแนวทางที่มักถูกพูดถึงทั่วไป ไม่ใช่กฎตายตัวหรือคำแนะนำการลงทุน',
      lgGroupSummaryGold: 'รวมซื้อ {amt} · {weight} บาททองคำ (≈ {gram} กรัม) · ต้นทุนเฉลี่ย {avg}/บาททองคำ',
      lgGroupValueNow: ' · มูลค่าตอนนี้ {val} <b style="color:{color}">({sign}{pl}, {sign2}{pct}%)</b>',
      jewelryNote: 'ร้านทองส่วนใหญ่รับซื้อคืนทองรูปพรรณที่ราคาเนื้อทอง (เท่าทองแท่ง) — ค่ากำเหน็จที่จ่ายไปตอนซื้อจะไม่ได้คืน จึงคำนวณมูลค่าปัจจุบันด้วยราคาขายคืนทองแท่งเช่นกัน',
      logThDate: 'วันที่', logThType: 'ชนิด', logThPaid: 'เงินที่จ่าย', logThPricePerUnit: 'ราคา/หน่วยที่ซื้อ', logThWeight: 'น้ำหนักที่ได้',
      typeJewelryShort: 'รูปพรรณ', typeBarShort: 'แท่ง',
      alertAmtPrice: 'กรอกเงินที่จ่ายและราคา/หน่วยที่ซื้อให้ถูกต้อง', chipFetchFail: '— ดึงไม่ได้ตอนนี้',
      alertGPriceUsd: 'กรอกราคาทองโลกตอนนี้ก่อน', alertGHiLo: 'กรอกราคาสูงสุด/ต่ำสุดของรอบด้วยเพื่อประเมิน',
      driveConnectFailedAuto: 'เชื่อมต่ออัตโนมัติไม่สำเร็จ (อาจเพราะเบราว์เซอร์บล็อก cookie ข้ามโดเมน) — กดปุ่มเชื่อมต่ออีกครั้ง',
      driveConnectFailed: 'เชื่อมต่อไม่สำเร็จ: {err}', driveLoadingGis: 'กำลังโหลด Google Identity Services… รออีก 2-3 วิแล้วลองใหม่', driveRequesting: 'กำลังขอสิทธิ์เชื่อมต่อ…',
      driveErrSearchFolder: 'ค้นหาโฟลเดอร์ไม่สำเร็จ ({status})', driveErrCreateFolder: 'สร้างโฟลเดอร์ไม่สำเร็จ ({status})',
      driveErrSearchFile: 'ค้นหาไฟล์ไม่สำเร็จ ({status})', driveErrDownload: 'ดาวน์โหลดไม่สำเร็จ ({status})', driveErrUpload: 'บันทึกขึ้น Drive ไม่สำเร็จ ({status})',
      driveSyncing: 'กำลังซิงก์…', driveSyncedAt: 'ซิงก์กับ Google Drive แล้ว · {t}', driveLastSync: 'ซิงก์ล่าสุด {t}',
      driveSessionExpired: 'เซสชันหมดอายุ — กดปุ่มเชื่อมต่อ Drive อีกครั้ง', driveSyncFailed: 'ซิงก์ไม่สำเร็จ: {msg}'
    },
    en: {
      crumbHome: 'Investing', crumbHere: 'Gold',
      pageTitle: "Gold — Today's Price + Savings Planner",
      priceTitle: "Today's Gold Price (baht/baht-weight)",
      barBuyLabel: 'Gold bar — buy price', boughtUnit: '(you pay)', barSellLabel: 'Gold bar — sell-back price', receivedUnit: '(you receive)',
      jewelryBuyLabel: 'Gold jewelry — buy price', jewelrySellLabel: 'Gold jewelry — sell-back price',
      goldThStatusDefault: "Fetching today's gold price…", refreshPriceBtn: 'Refresh price',
      priceHint: 'Prices are "baht per baht-weight" (the Thai gold weight unit, ~15.244 grams) · the buy/sell-back spread on jewelry is much wider than on bars, because it includes a making charge that is not refunded on resale',
      verdictTitle: 'Is it cheap or expensive right now',
      verdictDesc: 'Assessed from <b>the global gold price trend (GC=F, USD/oz)</b> as a directional proxy — the Thai price above is the real traded price, moving the same direction but with different numbers due to the baht exchange rate + import premium. Not investment advice',
      gSrcBadgeDefault: 'Checking trend…', gVerdictLoadingDefault: 'Loading…', chipLoadingDefault: 'Loading…',
      techDetailsSummary: 'View technical details (USD/oz, no need to understand it)',
      manualHint: "Couldn't auto-fetch the trend right now — enter it yourself to assess (find the global gold price from any financial news site/app)",
      gPriceUsdLabel: 'Global gold price now', unitUsdOz: '(USD/oz)', gHiUsdLabel: 'Period high', gLoUsdLabel: 'Period low', manualEvalBtn: 'Assess from this price',
      dcaTitle: 'Gold Savings Plan (DCA)', dcaDesc: 'Buy the same amount of gold every month without timing the market — suited to holding gold as a long-term diversification tool',
      dcaPmtLabel: 'Save per month', unitBaht: '(baht)', dcaUnitLabel: 'Display unit', unitBahtGold: 'Baht-weight', unitGram: 'Grams',
      dcaYearsLabel: 'Plan ahead', unitYears: '(years)', dcaStartLabel: 'Starting gold price', unitBahtPerBahtGold: '(baht/baht-weight)', dcaStartPh: "Waiting for today's price to load…",
      dcaCagrLabel: 'Assumed average gold growth', unitPctYear: '(%/year)', calcPlanBtn: 'Calculate Plan',
      dcaContribLabel: 'Total contributed', dcaWeightLabel: 'Gold weight accumulated', dcaValueLabel: 'Estimated value at plan end', dcaGainLabel: 'Gain from price change',
      chartValue: 'Total value', chartCost: 'Money contributed (cost)', viewYearTableSummary: 'View year-by-year table',
      ddTitle: 'Market dip = a chance to add gold (optional)', gdNowLabel: 'Gold price now', gdNowPh: "Auto-filled from today's price",
      gdAthLabel: 'All-time high (ATH) seen', gdAthPh: 'Enter yourself', ddBtn: 'Get recommendation',
      tr10m: 'Small dip', tr20m: 'Sharp dip', tr30m: 'Very heavy dip',
      ddHint: "Concept: a price dip = things get cheaper. If you have reserve funds, add to your purchase at levels you set in advance (this is not a prediction of further declines) · the ATH must be entered manually, since Thai gold prices have no free historical data source",
      allocTitle: 'Gold Allocation in Your Portfolio', allocDesc: "A common general guideline (not a fixed rule): hold ~5–10% of your total portfolio in gold as a diversification tool, not a core asset, since gold pays no dividends/interest",
      alPortfolioLabel: 'Estimated total portfolio value', alPortfolioPh: 'e.g. 300000', alGoldNowLabel: 'Current gold holding value', alGoldNowPh: 'Auto-filled from your gold log', alBtn: 'Calculate Allocation',
      driveTitle: 'Back Up Gold Log to Google Drive',
      driveDesc: 'Connect once, and your gold log below will sync to Drive automatically on every change (a file in your own "OME_Progress" folder — separate from the stock pages, no mixing)',
      driveConnectBtn: 'Connect Google Drive', driveConnectedBtn: 'Google Drive connected',
      logTitle: 'My Gold Log', logDesc: 'Log every purchase to know your average cost and current value (stored on your device + auto-synced to Drive if connected above)',
      lgTypeLabel: 'Type', typeBar: 'Gold bar', typeJewelry: 'Gold jewelry', lgUnitLabel: 'Unit',
      lgAmtLabel: 'Amount paid', lgAmtPh: 'e.g. 35000', lgPriceLabel: 'Price/unit paid', lgPricePh: 'e.g. 70950', lgAddBtn: '+ Add',
      lgEmptyDefault: 'No entries yet — log every purchase to know your average cost and current value',
      factorsSummary: 'Factors That Affect the Gold Price', factDirectH: 'Direct factors',
      factRealB: 'Real interest rates', factRealRest: ' — gold pays no interest/dividends, so higher real rates make holding gold less attractive versus bonds',
      factUsdB: 'US dollar strength', factUsdRest: ' — gold is priced in dollars, a stronger dollar usually pushes the gold price down (inverse relationship)',
      factTnxB: 'US 10-year treasury yield', factTnxRest: " — used as a rough gauge of interest-rate direction (not a direct real rate)",
      factCbB: 'Central bank gold reserve buying', factCbRest: ' — in recent years many countries (especially emerging markets) have continuously bought gold to build reserves, a long-term price support',
      factInfB: 'Inflation expectations', factInfRest: ' — gold is often viewed as an inflation hedge',
      factIndirectH: 'Indirect factors',
      factGeoB: 'Geopolitical risk/war', factGeoRest: ' — high uncertainty usually pushes people toward gold as a safe haven asset',
      factRecB: 'Recession fears', factRecRest: ' — weak economic signals usually boost demand for safe-haven assets',
      factVolB: 'Stock market volatility', factVolRest: ' — when stock markets are volatile/falling sharply, some money usually flows into gold',
      factCcB: 'Currency crises/capital outflows', factCcRest: ' — in emerging markets, gold is often a place to park money when the local currency is highly volatile',
      factNote: "Note: some real figures (real interest rates/TIPS, central bank gold purchase data, inflation expectations) have no free API that can be fetched directly from a browser — this section is therefore general knowledge, not a live number, unlike the 2 items above which have a live number chip",
      ageJustNow: 'just now', ageMinsAgo: '{n} min ago', ageHrsAgo: '{n} hr ago', ageDaysAgo: '{n} days ago',
      whyCheapRange: 'Price is in the cheap part of the 3-month range', whyExpensiveRange: 'Price is in the expensive part of the 3-month range',
      whyRsiLow: 'Selling pressure easing (RSI low, starting to recover)', whyRsiHigh: 'Price is overheated (RSI high, risk of a pullback)',
      whyMomUp: 'Momentum is turning positive', whyMomDn: 'Momentum is weakening',
      whyUptrend: 'Still in an uptrend', whyDowntrend: 'Below the trend line (downtrend/consolidation)',
      whyBbLow: 'Price is touching the lower band (often a bounce point)', whyBbHigh: 'Price is hitting the upper band', whyNeutral: 'Price is in the middle of the range, no clear signal yet',
      vInterestingGold: "Interesting — gold price is in a cheap zone relative to the trend", vCarefulGold: "Careful — gold price is expensive relative to the trend", vMidGold: 'Neutral — no standout opportunity yet',
      whyCheapPct: 'Price is toward the cheap end of the range (~{pct}% of low→high)', whyExpensivePct: 'Price is toward the expensive end of the range (~{pct}% of low→high)', whyMidPct: 'Price is in the middle of the range (~{pct}% of low→high)',
      goldThFetching: "Fetching today's gold price…", manualEnterAll: 'Entering price manually… fill in all 4 fields to use this',
      badgeManualText: 'Entered manually', manualUsedStatus: 'Now using the manually entered price', badgeManualUsedText: 'Using manually entered price',
      fetchSuccess: 'Fetched price successfully', fetchRetrying: 'Fetch failed, retrying… ({n}/{total})',
      badgeRealLive: 'Live price', badgeRealLiveUpdated: ' · updated {date} {time}',
      badgeStaleCache: 'Live fetch failed — using saved price ({age})', statusStaleCache: 'Live fetch failed right now (tried {n} times) — using the saved price',
      statusFetchFailNoCache: "Couldn't auto-fetch the gold price right now (tried {n} times) — enter it yourself in the fields above, or try refreshing again",
      badgeIntlTrend: 'Trend from the global gold price (GC=F)', badgeStaleSuffix: ' · latest {age}', badgeDaysSuffix: ' · {days} days',
      badgeManualEval: 'Assessed from manually entered price', badgeFetchFail: "Couldn't fetch the global gold trend right now — enter it below to assess yourself", gVerdictNoData: 'No data yet',
      detEma20: '20-day MA (EMA20)', detEma50: '50-day MA (EMA50)', detRsi: 'RSI (14)', detMacd: 'MACD histogram',
      detSupport: 'Latest support', detResistance: 'Latest resistance', detAdx: 'Trend strength (ADX 14)', detAdxStrong: ' · strong', detAdxWeak: ' · weak', detNoData: '—',
      alertStartPrice: 'Enter a valid starting gold price (or wait for today\'s price to load first, then try again)', alertPmt: 'Enter a valid monthly savings amount',
      dcaContribSub: '{amt} baht/month × {months} months', dcaWeightAltGram: '≈ {v} baht-weight', dcaWeightAltBaht: '≈ {v} grams',
      yrTableColYear: 'End of year', yrTableColContrib: 'Contributed', yrTableColWeight: 'Accumulated weight', yrTableColValue: 'Value', yrRowLabel: 'Year {n}',
      unitGramShort: ' g', unitBahtGoldShort: ' bw',
      ddNearAth: 'The price is currently near its all-time high (dip {dd}%) — a normal saving of {base}/month is enough, no need to add extra',
      ddNormal: 'Down <b>{dd}%</b> from the all-time high — still considered normal, save as planned at {base}/month',
      ddTierMsg: 'Down <b>{dd}%</b> from the all-time high — per the rule you set, consider increasing this month\'s purchase to <b>×{mult}</b> ≈ <b>{amt}</b> (if you have reserve funds)',
      ddWarn: "Warning: a dip doesn't mean it won't fall further — only add what you have in reserve funds, without affecting your daily life",
      alertPortfolio: 'Enter an estimated total portfolio value first',
      allocLow: 'Gold allocation ≈ {pct}% of the portfolio — below the commonly cited range (5–10%). If you want more diversification from gold, you can gradually increase it',
      allocGood: 'Gold allocation ≈ {pct}% of the portfolio — within the range beginner investors commonly use as a guideline (5–10%)',
      allocHigh: 'Gold allocation ≈ {pct}% of the portfolio — above the common range. Gold pays no dividends/interest, so holding too much may drag down the portfolio\'s long-term overall return',
      allocNote: "The 5–10% figure is a commonly cited guideline, not a fixed rule or investment advice",
      lgGroupSummaryGold: 'Total bought {amt} · {weight} baht-weight (≈ {gram} grams) · average cost {avg}/baht-weight',
      lgGroupValueNow: ' · current value {val} <b style="color:{color}">({sign}{pl}, {sign2}{pct}%)</b>',
      jewelryNote: "Most gold shops buy back jewelry at the raw gold price (same as bars) — the making charge paid on purchase is not refunded, so the current value is calculated using the bar sell-back price as well",
      logThDate: 'Date', logThType: 'Type', logThPaid: 'Amount paid', logThPricePerUnit: 'Price/unit paid', logThWeight: 'Weight received',
      typeJewelryShort: 'Jewelry', typeBarShort: 'Bar',
      alertAmtPrice: 'Enter a valid amount paid and price/unit', chipFetchFail: '— could not fetch right now',
      alertGPriceUsd: 'Enter the current global gold price first', alertGHiLo: 'Enter the period high/low as well to assess',
      driveConnectFailedAuto: "Automatic reconnect failed (possibly because the browser blocks cross-domain cookies) — click Connect again",
      driveConnectFailed: 'Connect failed: {err}', driveLoadingGis: 'Loading Google Identity Services… wait a couple of seconds and try again', driveRequesting: 'Requesting connection permission…',
      driveErrSearchFolder: 'Folder search failed ({status})', driveErrCreateFolder: 'Folder creation failed ({status})',
      driveErrSearchFile: 'File search failed ({status})', driveErrDownload: 'Download failed ({status})', driveErrUpload: 'Saving to Drive failed ({status})',
      driveSyncing: 'Syncing…', driveSyncedAt: 'Synced with Google Drive · {t}', driveLastSync: 'Last synced {t}',
      driveSessionExpired: 'Session expired — click Connect Drive again', driveSyncFailed: 'Sync failed: {msg}'
    }
  };
  function t(key, vars) {
    var s = (I18N[getUILang()] || I18N.th)[key];
    if (s == null) s = I18N.th[key] || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  }
  function applyStaticI18n() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) { el.innerHTML = t(el.getAttribute('data-i18n-html')); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) { el.placeholder = t(el.getAttribute('data-i18n-placeholder')); });
  }

  /* ── อินดิเคเตอร์ (สูตรมาตรฐาน, ใช้ประเมินแนวโน้มราคาทองโลก GC=F — asset-agnostic) ── */
  function sma(arr, n) {
    if (arr.length < n) return NaN;
    var s = 0; for (var i = arr.length - n; i < arr.length; i++) s += arr[i];
    return s / n;
  }
  function smaSeries(arr, n) {
    var out = new Array(arr.length), i, s = 0;
    for (i = 0; i < arr.length; i++) { s += arr[i]; if (i >= n) s -= arr[i - n]; if (i >= n - 1) out[i] = s / n; }
    return out;
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

  /* ── วิเคราะห์ (มีซีรีส์เต็ม) → ไฟจราจร ─────────────────────── */
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
    if (score >= 2) { light = 'green'; verdict = t('vInterestingGold'); }
    else if (score <= -1) { light = 'red'; verdict = t('vCarefulGold'); }
    else { light = 'yellow'; verdict = t('vMidGold'); }
    var why = (light === 'green' ? pros : light === 'red' ? cons : (pros.concat(cons)))[0] || t('whyNeutral');

    return {
      light: light, verdict: verdict, why: why, pros: pros, cons: cons, score: score,
      price: price, resistance: sr.resistance, uptrend: uptrend, rsi: r, adx: adxV,
      det: { ema20: ema20, ema50: ema50, rsi: r, macdHist: mac ? mac.hist : NaN,
             support: sr.support, resistance: sr.resistance, posRange: posRange, adx: adxV }
    };
  }
  function analyzeSimple(price, hi, lo) {
    var pos = (price - lo) / Math.max(1e-9, hi - lo), pct = Math.round(pos * 100);
    var light, verdict, why;
    if (pos < 0.35) { light = 'green'; verdict = t('vInterestingGold'); why = t('whyCheapPct', { pct: pct }); }
    else if (pos > 0.75) { light = 'red'; verdict = t('vCarefulGold'); why = t('whyExpensivePct', { pct: pct }); }
    else { light = 'yellow'; verdict = t('vMidGold'); why = t('whyMidPct', { pct: pct }); }
    return { light: light, verdict: verdict, why: why, pros: [], cons: [], price: price, resistance: hi, det: { posRange: pos, support: lo, resistance: hi }, simple: true };
  }

  /* ── สร้างชุดข้อมูลจาก Yahoo (ใช้ GC=F เป็นตัวแทนราคาทองโลก) ── */
  function daysAgoDates(n) {
    var out = [], d = new Date(); d.setHours(0, 0, 0, 0);
    for (var i = n - 1; i >= 0; i--) { var x = new Date(d); x.setDate(d.getDate() - i); out.push(x.toISOString().slice(0, 10)); }
    return out;
  }
  function toSeries(times, opens, highs, lows, closes, volumes) {
    var ohlc = [], i;
    for (i = 0; i < times.length; i++) ohlc.push({ time: times[i], open: opens[i], high: highs[i], low: lows[i], close: closes[i] });
    return { times: times, closes: closes, highs: highs, lows: lows, ohlc: ohlc };
  }
  function parseYahoo(j) {
    var res = j && j.chart && j.chart.result && j.chart.result[0];
    var ts = res && res.timestamp, q = res && res.indicators && res.indicators.quote && res.indicators.quote[0];
    if (!ts || !q || !q.close) throw new Error('no data');
    var times = [], opens = [], highs = [], lows = [], closes = [], vols = [], i;
    for (i = 0; i < ts.length; i++) {
      if (q.close[i] == null) continue;
      times.push(new Date(ts[i] * 1000).toISOString().slice(0, 10));
      opens.push(q.open[i] != null ? q.open[i] : q.close[i]);
      highs.push(q.high[i] != null ? q.high[i] : q.close[i]);
      lows.push(q.low[i] != null ? q.low[i] : q.close[i]);
      closes.push(q.close[i]); vols.push(q.volume && q.volume[i] ? q.volume[i] : 0);
    }
    if (closes.length < 5) throw new Error('short');
    return toSeries(times, opens, highs, lows, closes, vols);
  }
  function fetchOne(url, timeoutMs, parser) {
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var to = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs || 8000) : null;
    return fetch(url, ctrl ? { signal: ctrl.signal } : undefined)
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.text(); })
      .then(function (t) { if (to) clearTimeout(to); return (parser || defaultYahooParser)(t); });
  }
  function defaultYahooParser(t) { return parseYahoo(JSON.parse(t)); }
  function fetchPrice(sym) {
    var base = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?range=1y&interval=1d';
    var enc = encodeURIComponent(base);
    var tries = [
      { name: 'allorigins', url: 'https://api.allorigins.win/raw?url=' + enc },
      { name: 'codetabs', url: 'https://api.codetabs.com/v1/proxy/?quest=' + enc },
      { name: 'corseu', url: 'https://cors.eu.org/' + base },
      { name: 'corsworkers', url: 'https://test.cors.workers.dev/?' + base },
      { name: 'corsproxy', url: 'https://corsproxy.io/?url=' + enc },
      { name: 'ตรง', url: base }
    ];
    var i = 0, best = null;
    function next() {
      if (i >= tries.length) return best ? Promise.resolve(best) : Promise.reject(new Error('all failed'));
      var t = tries[i++];
      return fetchOne(t.url).then(function (s) {
        s.source = t.name;
        if (!best || s.closes.length > best.closes.length) best = s;
        if (best.closes.length >= 60) return best;
        return next();
      }, function () { return next(); });
    }
    return next();
  }
  function cacheKey(sym) { return 'tanot:invest:cache:gold:' + sym; }
  function saveCache(sym, s) {
    try {
      var o = { ts: Date.now(), t: s.times, o: s.ohlc.map(function (b) { return b.open; }), h: s.highs, l: s.lows, c: s.closes };
      localStorage.setItem(cacheKey(sym), JSON.stringify(o));
    } catch (e) {}
  }
  function loadCache(sym) {
    try {
      var o = JSON.parse(localStorage.getItem(cacheKey(sym)));
      if (!o || !o.c || o.c.length < 5) return null;
      var s = toSeries(o.t, o.o, o.h, o.l, o.c); s.cachedAt = o.ts; return s;
    } catch (e) { return null; }
  }
  function getSeries(sym) {
    return fetchPrice(sym).then(function (s) {
      saveCache(sym, s); return { series: s, stale: false };
    }, function (e) {
      var c = loadCache(sym);
      if (c) return { series: c, stale: true, cachedAt: c.cachedAt };
      throw e;
    });
  }
  function cacheAgeText(ts) {
    if (!ts) return '';
    var mins = Math.round((Date.now() - ts) / 60000);
    if (mins < 1) return t('ageJustNow');
    if (mins < 60) return t('ageMinsAgo', { n: mins });
    var hrs = Math.round(mins / 60);
    if (hrs < 24) return t('ageHrsAgo', { n: hrs });
    return t('ageDaysAgo', { n: Math.round(hrs / 24) });
  }

  /* ── ราคาทองไทย (thai-gold-api community project, MIT) ────────── */
  function parseGoldTH(t) {
    var j = JSON.parse(t), r = j && j.response;
    if (!r || !r.price || !r.price.gold_bar || !r.price.gold) throw new Error('no data');
    function n(s) { return parseFloat(String(s).replace(/,/g, '')); }
    var bar = r.price.gold_bar, jew = r.price.gold;
    /* ฟิลด์ API ตั้งชื่อมุมมองร้านทอง (sell=ร้านขาย/คุณซื้อ, buy=ร้านซื้อคืน/คุณขาย) — map เป็นมุมมองผู้ใช้ตรงๆ กันสับสน */
    var out = {
      barBuyPrice: n(bar.sell), barSellPrice: n(bar.buy),
      jewelryBuyPrice: n(jew.sell), jewelrySellPrice: n(jew.buy),
      updateDate: r.update_date, updateTime: r.update_time
    };
    var vals = [out.barBuyPrice, out.barSellPrice, out.jewelryBuyPrice, out.jewelrySellPrice], i;
    for (i = 0; i < vals.length; i++) if (!isFinite(vals[i])) throw new Error('bad numbers');
    return out;
  }
  function fetchGoldTH() {
    var base = 'https://api.chnwt.dev/thai-gold-api/latest', enc = encodeURIComponent(base);
    var tries = [
      { url: base },
      { url: 'https://api.allorigins.win/raw?url=' + enc },
      { url: 'https://api.codetabs.com/v1/proxy/?quest=' + enc },
      { url: 'https://cors.eu.org/' + base },
      { url: 'https://test.cors.workers.dev/?' + base },
      { url: 'https://corsproxy.io/?url=' + enc }
    ];
    var i = 0;
    function next() {
      if (i >= tries.length) return Promise.reject(new Error('all failed'));
      return fetchOne(tries[i++].url, 7000, parseGoldTH).catch(next);
    }
    return next();
  }
  function goldThCacheKey() { return 'tanot:invest:cache:gold:th'; }
  function saveGoldThCache(o) { try { var c = {}; for (var k in o) c[k] = o[k]; c.ts = Date.now(); localStorage.setItem(goldThCacheKey(), JSON.stringify(c)); } catch (e) {} }
  function loadGoldThCache() { try { var o = JSON.parse(localStorage.getItem(goldThCacheKey())); return (o && isFinite(o.barBuyPrice)) ? o : null; } catch (e) { return null; } }

  function setGoldThStatus(msg, cls) { var el = $('goldThStatus'); el.textContent = msg; el.className = 'status' + (cls ? ' ' + cls : ''); }
  function fillGoldThFields(o) {
    $('barBuy').value = o.barBuyPrice.toFixed(2);
    $('barSell').value = o.barSellPrice.toFixed(2);
    $('jewelryBuy').value = o.jewelryBuyPrice.toFixed(2);
    $('jewelrySell').value = o.jewelrySellPrice.toFixed(2);
    if (!$('dcaStart').value) $('dcaStart').value = o.barBuyPrice.toFixed(2);
    if (!$('gdNow').value) $('gdNow').value = o.barBuyPrice.toFixed(2);
    if ($('dcaOut').style.display === 'none') doDCA();
  }
  var GOLD_TH_RETRIES = 2; /* จำนวนครั้งที่ลองดึงราคาสดทั้งหมด ก่อนตกไป cache/กรอกเอง */
  var GOLD_TH_RETRY_DELAY = 2500; /* ms — เผื่อกรณี rate-limit ชั่วคราวของ API ชุมชน */
  /* ── ผู้ใช้กรอกราคาทองไทยเองในช่อง (แทนที่จะรอดึงอัตโนมัติ) — ให้เห็นผลทันทีที่กรอก ── */
  function onManualPriceInput() {
    var b1 = num($('barBuy').value), b2 = num($('barSell').value), j1 = num($('jewelryBuy').value), j2 = num($('jewelrySell').value);
    var badge = $('goldThBadge'); badge.style.display = 'inline-block'; badge.className = 'src-badge paste';
    if (![b1, b2, j1, j2].every(isFinite)) {
      badge.textContent = t('badgeManualText');
      setGoldThStatus(t('manualEnterAll'));
      return;
    }
    badge.textContent = t('badgeManualUsedText');
    setGoldThStatus(t('manualUsedStatus'), 'ok');
    if (!$('dcaStart').value) $('dcaStart').value = b1.toFixed(2);
    if (!$('gdNow').value) $('gdNow').value = b1.toFixed(2);
    if ($('dcaOut').style.display === 'none') doDCA();
    renderGoldLog(); /* ใช้ barSell ล่าสุดคำนวณมูลค่าสมุดทองใหม่ */
  }

  function runThaiFetch() {
    setGoldThStatus(t('goldThFetching'));
    $('goldThBadge').style.display = 'none';
    attemptGoldTH(1);
  }
  function attemptGoldTH(tryNum) {
    fetchGoldTH().then(function (o) {
      saveGoldThCache(o);
      fillGoldThFields(o);
      var badge = $('goldThBadge'); badge.style.display = 'inline-block'; badge.className = 'src-badge real';
      badge.textContent = t('badgeRealLive') + (o.updateDate ? t('badgeRealLiveUpdated', { date: o.updateDate, time: o.updateTime || '' }) : '');
      setGoldThStatus(t('fetchSuccess'), 'ok');
    }, function () {
      if (tryNum < GOLD_TH_RETRIES) {
        setGoldThStatus(t('fetchRetrying', { n: tryNum + 1, total: GOLD_TH_RETRIES }));
        setTimeout(function () { attemptGoldTH(tryNum + 1); }, GOLD_TH_RETRY_DELAY);
        return;
      }
      var c = loadGoldThCache();
      if (c) {
        fillGoldThFields(c);
        var badge = $('goldThBadge'); badge.style.display = 'inline-block'; badge.className = 'src-badge real';
        badge.textContent = t('badgeStaleCache', { age: cacheAgeText(c.ts) });
        setGoldThStatus(t('statusStaleCache', { n: GOLD_TH_RETRIES }), 'ok');
      } else {
        var badge = $('goldThBadge'); badge.style.display = 'inline-block'; badge.className = 'src-badge paste';
        badge.textContent = t('badgeManualText');
        setGoldThStatus(t('statusFetchFailNoCache', { n: GOLD_TH_RETRIES }), 'err');
      }
    });
  }

  /* ── ไฟจราจร "ถูก/แพงตอนนี้ไหม" จากแนวโน้มราคาทองโลก (GC=F) ──── */
  function showGoldVerdict(a, meta) {
    var el = $('gSrcBadge');
    if (meta.kind === 'real') {
      el.className = 'src-badge real';
      el.textContent = t('badgeIntlTrend') + (meta.stale ? t('badgeStaleSuffix', { age: cacheAgeText(meta.cachedAt) }) : '') + (meta.days ? t('badgeDaysSuffix', { days: meta.days }) : '');
    } else if (meta.kind === 'manual') {
      el.className = 'src-badge paste';
      el.textContent = t('badgeManualEval');
    } else {
      el.className = 'src-badge paste';
      el.textContent = t('badgeFetchFail');
    }
    if (!a) {
      $('gLight').className = 'light gray';
      $('gBulb').textContent = '';
      $('gBulb').style.background = '#B8C0D4';
      $('gVerdict').textContent = t('gVerdictNoData');
      $('gWhy').textContent = '';
      $('gDetailsBox').style.display = 'none';
      return;
    }
    /* วาดวงกลมสีด้วย CSS แทน emoji 🟢🟡🔴 — บางอุปกรณ์/เบราว์เซอร์ไม่มีฟอนต์รองรับ
       emoji วงกลมสี (โดยเฉพาะ 🟢/🟡 ที่เพิ่งเข้า Unicode ทีหลัง) แสดงเป็นกล่องว่างแทน
       ซึ่งทำให้ไฟจราจร (จุดขายหลักของหน้านี้) สื่อความหมายไม่ได้เลย */
    var bulbColors = { green: 'var(--ok)', yellow: 'var(--amber)', red: 'var(--err)' };
    $('gLight').className = 'light ' + a.light;
    $('gBulb').textContent = '';
    $('gBulb').style.background = bulbColors[a.light] || '#B8C0D4';
    $('gVerdict').textContent = a.verdict;
    $('gWhy').textContent = a.why;
    if (a.det && !a.simple && isFinite(a.det.rsi)) {
      var d = a.det, rows = [
        [t('detEma20'), fmt(d.ema20) + ' USD'], [t('detEma50'), fmt(d.ema50) + ' USD'],
        [t('detRsi'), fmt(d.rsi, 1)], [t('detMacd'), fmt(d.macdHist, 3)],
        [t('detSupport'), fmt(d.support) + ' USD'], [t('detResistance'), fmt(d.resistance) + ' USD'],
        [t('detAdx'), isFinite(d.adx) ? fmt(d.adx, 0) + (d.adx >= 20 ? t('detAdxStrong') : t('detAdxWeak')) : t('detNoData')]
      ], html = '';
      rows.forEach(function (r) { html += '<div class="k">' + r[0] + '</div><div class="v">' + r[1] + '</div>'; });
      $('gDetKv').innerHTML = html;
      $('gDetailsBox').style.display = 'block';
    } else { $('gDetailsBox').style.display = 'none'; }
  }
  function runIntlAnalysis() {
    getSeries('GC=F').then(function (r) {
      var a = analyzeSeries(r.series);
      lastVerdictMode = 'real';
      showGoldVerdict(a, { kind: 'real', stale: r.stale, cachedAt: r.cachedAt, days: r.series.closes.length });
      $('gManualWrap').style.display = 'none';
    }, function () {
      showGoldVerdict(null, { kind: 'fail' });
      $('gManualWrap').style.display = 'block';
    });
  }

  /* ── วางแผนออมทอง (DCA) — ปรับจากตัวจำลอง DCA ของหน้ากองทุน ให้ติดตาม "น้ำหนักทอง" แทนมูลค่ากองทุน ── */
  function simulateGoldDCA(pmt, startPrice, annualPct, months) {
    var rm = annualPct / 100 / 12;
    var price = startPrice, weight = 0, contrib = 0, series = [];
    for (var i = 0; i < months; i++) {
      price = price * (1 + rm);
      var w = pmt / price;
      weight += w; contrib += pmt;
      series.push({ month: i + 1, price: price, weight: weight, value: weight * price, contrib: contrib });
    }
    return { weight: weight, price: price, value: weight * price, contrib: contrib, series: series };
  }
  function drawGoldChart(r) {
    var s = r.series, W = 640, H = 220, pad = 8, n = s.length;
    var val = [], con = [], i;
    for (i = 0; i < n; i++) { val.push(s[i].value); con.push(s[i].contrib); }
    var max = Math.max(val[n - 1], con[n - 1]) || 1;
    var x = function (i) { return pad + i / Math.max(1, n - 1) * (W - 2 * pad); };
    var y = function (v) { return pad + (1 - v / max) * (H - 2 * pad); };
    function path(a) { var d = '', i; for (i = 0; i < a.length; i++) d += (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(a[i]).toFixed(1) + ' '; return d; }
    var area = path(val) + 'L' + x(n - 1).toFixed(1) + ' ' + y(0).toFixed(1) + ' L' + x(0).toFixed(1) + ' ' + y(0).toFixed(1) + ' Z';
    var svg = '';
    svg += '<path d="' + area + '" fill="#F5A524" opacity="0.12"/>';
    svg += '<path d="' + path(con) + '" fill="none" stroke="#8B94A8" stroke-width="1.6" stroke-dasharray="5 3"/>';
    svg += '<path d="' + path(val) + '" fill="none" stroke="#F5A524" stroke-width="2.4" stroke-linejoin="round"/>';
    $('dcaChart').innerHTML = svg;
  }
  function dcaYearTable(r, unit) {
    var html = '<table class="yr-table"><thead><tr><th>' + t('yrTableColYear') + '</th><th>' + t('yrTableColContrib') + '</th><th>' + t('yrTableColWeight') + '</th><th>' + t('yrTableColValue') + '</th></tr></thead><tbody>';
    var yrs = Math.round(r.series.length / 12), i;
    for (i = 1; i <= yrs; i++) {
      var idx = i * 12 - 1;
      if (idx >= r.series.length) break;
      var row = r.series[idx], w = unit === 'gram' ? row.weight * GRAM_PER_BAHT : row.weight;
      html += '<tr><td>' + t('yrRowLabel', { n: i }) + '</td><td>' + baht(row.contrib) + '</td><td>' + fmt(w, 4) + (unit === 'gram' ? t('unitGramShort') : t('unitBahtGoldShort')) + '</td><td>' + baht(row.value) + '</td></tr>';
    }
    html += '</tbody></table>';
    return html;
  }
  function doDCA() {
    var pmt = num($('dcaPmt').value) || 0;
    var startPrice = num($('dcaStart').value);
    var years = num($('dcaYears').value) || 10;
    var cagr = num($('dcaCagr').value);
    var unit = $('dcaUnit').value;
    if (!isFinite(cagr)) { cagr = 5; $('dcaCagr').value = 5; }
    if (!isFinite(startPrice) || startPrice <= 0) { alert(t('alertStartPrice')); return; }
    if (pmt <= 0) { alert(t('alertPmt')); return; }
    var months = Math.round(years * 12);
    var r = simulateGoldDCA(pmt, startPrice, cagr, months);
    $('dcaOut').style.display = 'block';

    var weightDisplay = unit === 'gram' ? r.weight * GRAM_PER_BAHT : r.weight;
    var altText = unit === 'gram' ? t('dcaWeightAltGram', { v: fmt(r.weight, 4) }) : t('dcaWeightAltBaht', { v: fmt(r.weight * GRAM_PER_BAHT, 2) });

    $('dcaContrib').textContent = baht(r.contrib);
    $('dcaContribSub').textContent = t('dcaContribSub', { amt: fmt0(pmt), months: months });
    $('dcaWeight').textContent = fmt(weightDisplay, 4) + (unit === 'gram' ? ' ' + t('unitGram').toLowerCase() : ' ' + t('unitBahtGold').toLowerCase());
    $('dcaWeightSub').textContent = altText;
    $('dcaValue').textContent = baht(r.value);
    $('dcaGain').textContent = (r.value - r.contrib >= 0 ? '+' : '') + baht(r.value - r.contrib);

    drawGoldChart(r);
    $('dcaYrTable').innerHTML = dcaYearTable(r, unit);
    lastGoldPlan = { pmt: pmt };
  }

  /* ── ตลาดย่อ = โอกาสเติมทอง ── */
  var TR = [{ dd: 10, x: 1.25 }, { dd: 20, x: 1.5 }, { dd: 30, x: 2 }];
  function doGoldDrawdown() {
    var now = num($('gdNow').value), ath = num($('gdAth').value);
    var out = $('gdOut');
    [].forEach.call(document.querySelectorAll('#gdTranche .tr-box'), function (b) { b.classList.remove('on'); });
    if (!isFinite(now) || !isFinite(ath) || ath <= 0) { out.style.display = 'none'; return; }
    var dd = (1 - now / ath) * 100;
    var base = lastGoldPlan.pmt || 3000;
    var mult = 1, tier = null;
    TR.forEach(function (t) { if (dd >= t.dd) { mult = t.x; tier = t; } });
    if (tier) document.querySelector('#gdTranche .tr-box[data-dd="' + tier.dd + '"]').classList.add('on');
    var msg;
    if (dd < 1) msg = t('ddNearAth', { dd: fmt(Math.max(0, dd), 1), base: baht(base) });
    else if (dd < 10) msg = t('ddNormal', { dd: fmt(dd, 1), base: baht(base) });
    else msg = t('ddTierMsg', { dd: fmt(dd, 1), mult: mult, amt: baht(base * mult) });
    out.innerHTML = msg + '<div style="font-size:12px;color:var(--muted);margin-top:6px">' + t('ddWarn') + '</div>';
    out.style.display = 'block';
  }

  /* ── สัดส่วนทองในพอร์ต ── */
  function doAllocation() {
    var portfolio = num($('alPortfolio').value), goldNow = num($('alGoldNow').value);
    var el = $('alOut');
    if (!isFinite(portfolio) || portfolio <= 0) { el.className = 'verdict-box warn'; el.textContent = t('alertPortfolio'); el.style.display = 'block'; return; }
    if (!isFinite(goldNow) || goldNow < 0) goldNow = 0;
    var pct = goldNow / portfolio * 100;
    var cls, txt;
    if (pct < 5) { cls = 'warn'; txt = t('allocLow', { pct: fmt(pct, 1) }); }
    else if (pct <= 10) { cls = 'go'; txt = t('allocGood', { pct: fmt(pct, 1) }); }
    else { cls = 'warn'; txt = t('allocHigh', { pct: fmt(pct, 1) }); }
    el.className = 'verdict-box ' + cls;
    el.innerHTML = txt + '<div style="font-size:12px;font-weight:500;margin-top:6px;opacity:.85">' + t('allocNote') + '</div>';
    el.style.display = 'block';
  }

  /* ── สมุดทองของฉัน ── */
  function loadGoldLog() { try { return JSON.parse(localStorage.getItem(LOG_KEY)) || []; } catch (e) { return []; } }
  function saveGoldLog(a) { try { localStorage.setItem(LOG_KEY, JSON.stringify(a)); } catch (e) {} DriveSync.scheduleSync(); }

  function updateAllocAuto(totalValue) {
    var el = $('alGoldNow');
    if (el && !el.value && totalValue > 0) el.value = Math.round(totalValue);
  }

  function renderGoldLog() {
    var log = loadGoldLog(), box = $('lgBox');
    if (!log.length) { box.innerHTML = '<div class="log-empty">' + t('lgEmptyDefault') + '</div>'; updateAllocAuto(0); return; }

    var barSellPrice = num($('barSell').value);
    var groups = { bar: { label: t('typeBar'), amt: 0, weight: 0 }, jewelry: { label: t('typeJewelry'), amt: 0, weight: 0 } };
    log.forEach(function (r) {
      var g = groups[r.type] || groups.bar;
      g.amt += r.amt; g.weight += toBahtWeight(r.weight, r.unit);
    });

    var html = '', totalValue = 0;
    ['bar', 'jewelry'].forEach(function (key) {
      var g = groups[key];
      if (g.weight <= 0) return;
      var avg = g.weight > 0 ? g.amt / g.weight : NaN;
      html += '<div class="log-group-hd">' + g.label + '</div>';
      html += '<div class="log-group-sub">' + t('lgGroupSummaryGold', { amt: baht(g.amt), weight: fmt(g.weight, 4), gram: fmt(g.weight * GRAM_PER_BAHT, 2), avg: baht(avg) });
      if (isFinite(barSellPrice)) {
        var val = g.weight * barSellPrice, pl = val - g.amt, pct = g.amt > 0 ? pl / g.amt * 100 : 0;
        totalValue += val;
        html += t('lgGroupValueNow', { val: baht(val), color: pl >= 0 ? 'var(--ok)' : 'var(--err)', sign: pl >= 0 ? '+' : '−', pl: baht(Math.abs(pl)), sign2: pct >= 0 ? '+' : '', pct: fmt(pct, 1) });
      }
      html += '</div>';
      if (key === 'jewelry') html += '<div class="log-group-note">' + t('jewelryNote') + '</div>';
    });

    html += '<table class="log-table"><thead><tr><th>' + t('logThDate') + '</th><th>' + t('logThType') + '</th><th>' + t('logThPaid') + '</th><th>' + t('logThPricePerUnit') + '</th><th>' + t('logThWeight') + '</th><th></th></tr></thead><tbody>';
    log.forEach(function (r, i) {
      var unitLabel = r.unit === 'gram' ? t('unitGramShort') : t('unitBahtGoldShort');
      html += '<tr><td>' + new Date(r.ts).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) + '</td>' +
        '<td>' + (r.type === 'jewelry' ? t('typeJewelryShort') : t('typeBarShort')) + '</td><td>' + baht(r.amt) + '</td><td>' + fmt(r.price, 2) + '</td>' +
        '<td>' + fmt(r.weight, 4) + unitLabel + '</td>' +
        '<td><button class="log-del" data-i="' + i + '">✕</button></td></tr>';
    });
    html += '</tbody></table>';
    box.innerHTML = html;
    [].forEach.call(box.querySelectorAll('.log-del'), function (b) {
      b.addEventListener('click', function () { var log = loadGoldLog(); log.splice(+b.getAttribute('data-i'), 1); saveGoldLog(log); renderGoldLog(); });
    });
    updateAllocAuto(totalValue);
  }

  function addGoldLog() {
    var type = $('lgType').value, unit = $('lgUnit').value;
    var amt = num($('lgAmt').value), price = num($('lgPrice').value);
    if (!isFinite(amt) || amt <= 0 || !isFinite(price) || price <= 0) { alert(t('alertAmtPrice')); return; }
    var log = loadGoldLog();
    log.push({ type: type, unit: unit, amt: amt, price: price, weight: amt / price, ts: Date.now() });
    saveGoldLog(log);
    $('lgAmt').value = ''; $('lgPrice').value = '';
    renderGoldLog();
  }

  /* ── ปัจจัยราคาทอง: ตัวเลขสด DXY / ดอกเบี้ย 10 ปีสหรัฐฯ (best-effort) ── */
  function parseQuoteLite(t) {
    var j = JSON.parse(t), res = j && j.chart && j.chart.result && j.chart.result[0];
    var meta = res && res.meta;
    if (!meta || !isFinite(meta.regularMarketPrice)) throw new Error('no meta');
    return { price: meta.regularMarketPrice, prevClose: meta.previousClose };
  }
  function fetchQuoteLite(sym) {
    var base = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?range=5d&interval=1d';
    var enc = encodeURIComponent(base);
    var tries = [
      { url: 'https://api.allorigins.win/raw?url=' + enc },
      { url: 'https://api.codetabs.com/v1/proxy/?quest=' + enc },
      { url: 'https://cors.eu.org/' + base },
      { url: 'https://test.cors.workers.dev/?' + base },
      { url: 'https://corsproxy.io/?url=' + enc },
      { url: base }
    ];
    var i = 0;
    function next() {
      if (i >= tries.length) return Promise.reject(new Error('fail'));
      return fetchOne(tries[i++].url, 7000, parseQuoteLite).catch(next);
    }
    return next();
  }
  function quoteCacheKey(tag) { return 'tanot:invest:cache:gold:' + tag; }
  function saveQuoteCache(tag, q) { try { localStorage.setItem(quoteCacheKey(tag), JSON.stringify({ ts: Date.now(), price: q.price, prevClose: q.prevClose })); } catch (e) {} }
  function loadQuoteCache(tag) { try { var o = JSON.parse(localStorage.getItem(quoteCacheKey(tag))); return (o && isFinite(o.price)) ? o : null; } catch (e) { return null; } }
  function renderFactorChip(id, sym, tag) {
    var el = $(id);
    fetchQuoteLite(sym).then(function (q) {
      saveQuoteCache(tag, q);
      writeChip(q);
    }, function () {
      var c = loadQuoteCache(tag);
      if (c) writeChip(c); else { el.textContent = t('chipFetchFail'); }
    });
    function writeChip(q) {
      var pct = isFinite(q.prevClose) && q.prevClose ? (q.price / q.prevClose - 1) * 100 : NaN;
      el.textContent = fmt(q.price, 2) + (isFinite(pct) ? (' (' + (pct >= 0 ? '+' : '') + fmt(pct, 2) + '%)') : '');
    }
  }

  /* ══════ สำรองสมุดทองขึ้น Google Drive (ไม่บังคับ) ══════ */
  var DRIVE_CLIENT_ID = '497048581273-akpavakt6m34lhqbjf1irg3m8vl6u27u.apps.googleusercontent.com';
  var DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
  var DRIVE_FOLDER_NAME = 'OME_Progress';
  var DRIVE_FILE_NAME = 'invest-gold-data.json';
  var DRIVE_CONNECTED_KEY = 'tanot:invest:gold:driveConnected';
  function nowTime() { return new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }); }

  var DriveSync = {
    tokenClient: null, accessToken: null, folderId: null, fileId: null,
    connected: false, syncing: false, pending: false, timer: null,

    setStatus: function (text, cls) {
      var el = $('driveStatusTxt'); if (!el) return;
      el.textContent = text; el.className = 'status' + (cls ? ' ' + cls : '');
    },
    setBtn: function () {
      var b = $('driveConnectBtn'); if (!b) return;
      b.textContent = this.connected ? t('driveConnectedBtn') : t('driveConnectBtn');
    },
    init: function () {
      try { this.connected = localStorage.getItem(DRIVE_CONNECTED_KEY) === '1'; } catch (e) {}
      this.setBtn();
      var self = this;
      (function wait() {
        if (!window.google || !google.accounts || !google.accounts.oauth2) { setTimeout(wait, 300); return; }
        self.tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: DRIVE_CLIENT_ID,
          scope: DRIVE_SCOPE,
          use_fedcm_for_prompt: true, // ลดโอกาสต้องกดยืนยันใหม่ทุกครั้งบนเบราว์เซอร์ที่บล็อก third-party cookie (เช่น Chrome รุ่นใหม่)
          callback: function (resp) {
            if (resp.error) {
              self.setStatus(self.connected ? t('driveConnectFailedAuto') : t('driveConnectFailed', { err: resp.error }), 'err');
              return;
            }
            self.accessToken = resp.access_token;
            self.connected = true;
            try { localStorage.setItem(DRIVE_CONNECTED_KEY, '1'); } catch (e) {}
            self.setBtn();
            self.firstSync();
          }
        });
        if (self.connected) self.tokenClient.requestAccessToken({ prompt: '' });
      })();
    },
    connect: function () {
      if (!this.tokenClient) { this.setStatus(t('driveLoadingGis'), 'err'); return; }
      this.setStatus(t('driveRequesting'), '');
      this.tokenClient.requestAccessToken({ prompt: this.accessToken ? '' : 'consent' });
    },
    authFetch: function (url, opts) {
      opts = opts || {}; opts.headers = opts.headers || {};
      opts.headers.Authorization = 'Bearer ' + this.accessToken;
      return fetch(url, opts);
    },
    ensureFolder: function () {
      var self = this;
      if (self.folderId) return Promise.resolve(self.folderId);
      var q = encodeURIComponent("name='" + DRIVE_FOLDER_NAME + "' and mimeType='application/vnd.google-apps.folder' and trashed=false");
      return self.authFetch('https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id,name)')
        .then(function (r) { if (!r.ok) throw new Error(t('driveErrSearchFolder', { status: r.status })); return r.json(); })
        .then(function (data) {
          if (data.files && data.files.length) { self.folderId = data.files[0].id; return self.folderId; }
          return self.authFetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' })
          }).then(function (r) { if (!r.ok) throw new Error(t('driveErrCreateFolder', { status: r.status })); return r.json(); })
            .then(function (d) { self.folderId = d.id; return self.folderId; });
        });
    },
    findFile: function () {
      var self = this;
      if (self.fileId) return Promise.resolve(self.fileId);
      var q = encodeURIComponent("name='" + DRIVE_FILE_NAME + "' and '" + self.folderId + "' in parents and trashed=false");
      return self.authFetch('https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id,name)')
        .then(function (r) { if (!r.ok) throw new Error(t('driveErrSearchFile', { status: r.status })); return r.json(); })
        .then(function (data) { self.fileId = (data.files && data.files[0] && data.files[0].id) || null; return self.fileId; });
    },
    download: function () {
      var self = this;
      return self.authFetch('https://www.googleapis.com/drive/v3/files/' + self.fileId + '?alt=media')
        .then(function (r) { if (!r.ok) throw new Error(t('driveErrDownload', { status: r.status })); return r.json(); });
    },
    upload: function (obj) {
      var self = this;
      var metadata = self.fileId ? {} : { name: DRIVE_FILE_NAME, parents: [self.folderId] };
      var form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', new Blob([JSON.stringify(obj)], { type: 'application/json' }));
      var url = self.fileId
        ? 'https://www.googleapis.com/upload/drive/v3/files/' + self.fileId + '?uploadType=multipart'
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id';
      return self.authFetch(url, { method: self.fileId ? 'PATCH' : 'POST', body: form })
        .then(function (r) { if (!r.ok) throw new Error(t('driveErrUpload', { status: r.status })); return r.json(); })
        .then(function (d) { if (d.id) self.fileId = d.id; return d; });
    },
    mergeByTs: function (a, b) {
      var map = {};
      (a || []).forEach(function (x) { if (x && x.ts != null) map[x.ts] = x; });
      (b || []).forEach(function (x) { if (x && x.ts != null) map[x.ts] = x; });
      var out = Object.keys(map).map(function (k) { return map[k]; });
      out.sort(function (x, y) { return (x.ts || 0) - (y.ts || 0); });
      return out;
    },
    firstSync: function () {
      var self = this;
      self.setStatus(t('driveSyncing'), '');
      self.ensureFolder().then(function () { return self.findFile(); })
        .then(function (fid) { return fid ? self.download() : null; })
        .then(function (remote) {
          var merged = self.mergeByTs(remote && remote.log, loadGoldLog());
          try { localStorage.setItem(LOG_KEY, JSON.stringify(merged)); } catch (e) {}
          renderGoldLog();
          return self.upload({ log: merged, savedAt: new Date().toISOString() });
        })
        .then(function () { self.setStatus(t('driveSyncedAt', { t: nowTime() }), 'ok'); })
        .catch(function (e) { self.setStatus('' + (e.message || e), 'err'); });
    },
    scheduleSync: function () {
      var self = this;
      if (!self.connected || !self.accessToken) return;
      self.pending = true;
      if (self.timer) clearTimeout(self.timer);
      self.timer = setTimeout(function () { self.pushNow(); }, 1800);
    },
    pushNow: function () {
      var self = this;
      if (self.syncing) { self.pending = true; return; }
      self.pending = false; self.syncing = true;
      self.setStatus(t('driveSyncing'), '');
      self.ensureFolder().then(function () { return self.findFile(); })
        .then(function () { return self.upload({ log: loadGoldLog(), savedAt: new Date().toISOString() }); })
        .then(function () { self.setStatus(t('driveLastSync', { t: nowTime() }), 'ok'); })
        .catch(function (e) {
          var msg = String(e && e.message || e);
          if (msg.indexOf('401') !== -1 || msg.indexOf('403') !== -1) {
            self.accessToken = null;
            self.setStatus(t('driveSessionExpired'), 'err');
          } else {
            self.setStatus(t('driveSyncFailed', { msg: msg }), 'err');
          }
        })
        .finally(function () {
          self.syncing = false;
          if (self.pending) self.scheduleSync();
        });
    }
  };

  /* ── init ───────────────────────────────────────────────────── */
  function init() {
    applyStaticI18n();
    ['barBuy', 'barSell', 'jewelryBuy', 'jewelrySell'].forEach(function (id) { $(id).addEventListener('input', onManualPriceInput); });
    $('goldThRefresh').addEventListener('click', runThaiFetch);
    $('gManualBtn').addEventListener('click', function () {
      var price = num($('gPriceUsd').value), hi = num($('gHiUsd').value), lo = num($('gLoUsd').value);
      if (!isFinite(price)) { alert(t('alertGPriceUsd')); return; }
      if (!isFinite(hi) || !isFinite(lo) || hi <= lo) { alert(t('alertGHiLo')); return; }
      lastVerdictMode = 'manual';
      showGoldVerdict(analyzeSimple(price, hi, lo), { kind: 'manual' });
    });
    $('dcaBtn').addEventListener('click', doDCA);
    $('gdBtn').addEventListener('click', doGoldDrawdown);
    $('alBtn').addEventListener('click', doAllocation);
    $('lgAdd').addEventListener('click', addGoldLog);
    $('driveConnectBtn') && $('driveConnectBtn').addEventListener('click', function () { DriveSync.connect(); });

    renderGoldLog();
    runThaiFetch();
    runIntlAnalysis();
    renderFactorChip('dxyChip', 'DX-Y.NYB', 'dxy');
    renderFactorChip('tnxChip', '^TNX', 'tnx');
    DriveSync.init();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.omeApplyLang = function () {
    applyStaticI18n();
    renderGoldLog();
    if (lastVerdictMode === 'manual') {
      var price = num($('gPriceUsd').value), hi = num($('gHiUsd').value), lo = num($('gLoUsd').value);
      if (isFinite(price) && isFinite(hi) && isFinite(lo) && hi > lo) showGoldVerdict(analyzeSimple(price, hi, lo), { kind: 'manual' });
    } else {
      runIntlAnalysis();
    }
    if ($('dcaOut').style.display !== 'none') doDCA();
    var gdOut = $('gdOut');
    if (gdOut.style.display !== 'none') doGoldDrawdown();
    var alOut = $('alOut');
    if (alOut.style.display !== 'none') doAllocation();
    renderFactorChip('dxyChip', 'DX-Y.NYB', 'dxy');
    renderFactorChip('tnxChip', '^TNX', 'tnx');
    DriveSync.setBtn();
  };

  window.__gold = { simulateGoldDCA: simulateGoldDCA, analyzeSeries: analyzeSeries, analyzeSimple: analyzeSimple, parseGoldTH: parseGoldTH, parseYahoo: parseYahoo, toBahtWeight: toBahtWeight };
})();
