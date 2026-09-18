/* ══════════════════════════════════════════════════════════════════
   Tanot — หุ้นไทย (มือใหม่ · สวิง)
   • กราฟแท่งเทียนจริงด้วย lightweight-charts (TradingView, Apache-2.0)
   • ดึงราคา .BK แบบ best-effort หลายเส้นทาง (มัก CORS บน static → มีตัวอย่าง/กรอกเองสำรอง)
   • คำนวณอินดิเคเตอร์เอง (SMA/EMA/RSI/MACD/Bollinger/ATR) → แปลเป็นไฟจราจร
   • แกนหลัก: คุมเงิน/ความเสี่ยง (ล็อต 100, stop, TP, จุดคุ้มทุน รวมค่าคอมฯ ขั้นต่ำ/วัน) — พอร์ตเก็บใน localStorage
   Stage 4: สแกนเนอร์ SET50 / สมุดเทรด / สำรองขึ้น Drive ย้ายไปหน้าแยก (invest-set50-scanner.html,
   invest-trade-journal.html) — พอร์ตของฉัน (ภาพรวมทั้งเว็บ) ชี้ไป invest-portfolio.html แทน
   หมายเหตุ: ตัวช่วยคิด ไม่ใช่คำแนะนำการลงทุน
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var lastSeries = null;
  var lastAnalysis = null;
  var lastNewsItems = null; // หัวข้อข่าวล่าสุดของหุ้นตัวที่กำลังดู (เติมโดย renderNewsBlock) — ให้ "สรุปหุ้นด้วย AI" อ้างอิงได้

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }
  function fmt(n, d) { d = d == null ? 2 : d; return isFinite(n) ? n.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'; }
  function fmt0(n) { return isFinite(n) ? Math.round(n).toLocaleString('th-TH') : '—'; }

  /* ══ ภาษา UI (ไทย/English) — จุดกลางเดียวทั้งเว็บคือ localStorage 'ome:lang' (ดู shell.js: window.OME_LANG)
     รูปแบบเดียวกับ word.js/cad.js/invest.html: I18N dict + t() + data-i18n attributes + window.omeApplyLang
     ให้เมนูตั้งค่ากลางเรียกตอนสลับภาษา — เพิ่ม data-i18n-html (ใช้ innerHTML แทน textContent) สำหรับ
     ข้อความที่มี tag ฝัง เช่น <b>/<a> อยู่ข้างใน (data-i18n ธรรมดาจะทำลาย tag ลูกเพราะ textContent ล้าง
     child node ทั้งหมด) ══ */
  var UI_LANG_KEY = 'ome:lang';
  function getUILang() { try { return localStorage.getItem(UI_LANG_KEY) === 'en' ? 'en' : 'th'; } catch (e) { return 'th'; } }
  var I18N = {
    th: {
      navOverview: 'ภาพรวม', navMyPortfolio: 'พอร์ตของฉัน', navMarket: 'ตลาด & สินทรัพย์', navLottery: 'สลาก & พันธบัตร', navNews: 'ข่าว & ธุรกิจ',
      crumbHome: 'การลงทุน', crumbHere: 'หุ้นไทย', pageDefaultTitle: 'หุ้นไทย — ตัวช่วยเข้า/ออก', whyTitleDefault: 'เหตุผลของสัญญาณ', tabNews: 'ข่าวและปฏิทิน',
      defaultSignal: 'สัญญาณ —', defaultSector: 'หุ้นไทย',
      step1Title: 'ราคาหุ้นตอนนี้', symLabel: 'ชื่อย่อหุ้น (เช่น PTT, ADVANC)', fetchBtn: 'ลองดึงราคา',
      priceNowLabel: 'ราคาตอนนี้ (บาท)', priceNowPh: 'เช่น 35.50', priceHiLabel: 'ราคาสูงสุดของรอบ', priceLoLabel: 'ราคาต่ำสุดของรอบ', periodPh: 'ช่วง 3 เดือน',
      liveModeHistorical: 'โหมดข้อมูล: ย้อนหลัง', liveMetaDefault: 'ตั้งค่าแหล่งข้อมูลสดได้ใน "ตั้งค่าข้อมูลตลาด"',
      refreshBtn: '↻ รีเฟรช', marketSettingsBtn: '⚙ ตั้งค่าข้อมูลตลาด',
      marketSettingsTitle: 'ข้อมูลตลาดแบบสด', providerLabel: 'แหล่งข้อมูล', providerGateway: 'Tanot Data Gateway (แนะนำ)', providerYahoo: 'Yahoo / ย้อนหลัง',
      apiKeyLabel: 'Twelve Data API Key', apiKeyNote: '(เก็บในเครื่องเท่านั้น)', apiKeyPh: 'ใส่เมื่อมี API key',
      intervalLabel: 'รีเฟรชทุก', interval5: '5 วินาที', interval10: '10 วินาที', interval30: '30 วินาที',
      saveSettingsBtn: 'บันทึกการตั้งค่า', clearApiKeyBtn: 'ล้าง API Key',
      analyzeBtn: 'ประเมินให้หน่อย', demoBtn: 'ดูกราฟตัวอย่าง (ฝึกอ่าน)',
      pasteSummary: 'วางราคาย้อนหลังเอง (ทางเลือก)', pasteHint: 'วางราคาปิดหลายวัน คั่นด้วยเว้นวรรค/บรรทัด/จุลภาค (เรียงเก่า→ใหม่)', pasteBtn: 'ใช้ราคานี้',
      chartTitle: 'กราฟราคา', tf1m: '1เดือน', tf3m: '3เดือน', tf6m: '6เดือน', tf1y: '1ปี', tgMa20: 'เฉลี่ย 20', tgMa50: 'เฉลี่ย 50',
      capUp: 'แท่งขึ้น', capDn: 'แท่งลง', capMa20: 'เฉลี่ย 20 วัน', capMa50: 'เฉลี่ย 50 วัน', capTouch: 'แตะบนกราฟเพื่อดูราคาแต่ละวัน',
      techDetailsSummary: 'ดูรายละเอียดทางเทคนิค (ไม่ต้องเข้าใจก็ได้)',
      aiSumTitle: 'สรุปหุ้นด้วย AI', aiSumBtn: 'สรุปให้หน่อย',
      step2Title: 'ถ้าจะซื้อ ควรใส่เงินเท่าไร ตั้งขายที่ไหน',
      capitalLabel: 'เงินลงทุนทั้งพอร์ต (บาท)', capitalPh: 'เช่น 100000', riskPctLabel: 'ยอมเสี่ยงต่อไม้', unitPctPortfolio: '(% ของพอร์ต)',
      entryLabel: 'ราคาเข้าซื้อ (บาท)', entryPh: '= ราคาตอนนี้', stopLabel: 'ราคาตัดขาดทุน (Stop)', stopPh: 'แนะนำอัตโนมัติ',
      commLabel: 'ค่าคอมฯ', unitPctPerTrade: '(% ต่อครั้ง)', commMinLabel: 'ค่าคอมฯ ขั้นต่ำ', unitBahtPerDay: '(บาท/วัน)',
      calcBtn: 'คำนวณ', saveToPortfolioBtn: 'บันทึกเข้าพอร์ต', savedBtn: 'บันทึกแล้ว',
      checklistTitle: 'ตรวจก่อนเข้าไม้ — ควรซื้อไหม?',
      checkBtn: 'ตรวจเช็กลิสต์',
      pfTitle: 'พอร์ตของฉัน (หุ้นไทย)', pfSeeAll: 'ดูพอร์ตรวมทั้งเว็บ →',
      pfSymLabel: 'ชื่อหุ้น', pfSharesLabel: 'จำนวนหุ้น', pfCostLabel: 'ราคาต้นทุน/หุ้น', pfAddBtn: '+ เพิ่มเข้าพอร์ต',
      pfEmptyDefault: 'ยังไม่มีหุ้นในพอร์ต',
      pfEmptyEmbed: 'ยังไม่มี {sym} ในพอร์ต',
      pfThSym: 'หุ้น', pfThShares: 'จำนวน', pfThCost: 'ต้นทุน/หุ้น', pfThCur: 'ราคาปัจจุบัน', pfThPl: 'กำไร/ขาดทุน',
      pfPricePh: 'ราคา', pfSellTitle: 'เช็กควรขาย?', pfSellBtn: 'ควรขาย?', pfDelTitle: 'ลบ',
      expectancyTitle: 'ระบบเทรดของคุณ "กำไรระยะยาว" ไหม?',
      eWinLabel: 'อัตราชนะ', unitPctWinTrades: '(% ของไม้ที่ชนะ)', eWinRLabel: 'กำไรเฉลี่ยตอนชนะ', unitR: '(เท่าของความเสี่ยง R)', eLossRLabel: 'ขาดทุนเฉลี่ยตอนแพ้',
      realityTitle: 'อ่านก่อนเอาเงินมาลงทุน (สำคัญมาก)',
      reality1: 'ลงทุนหุ้น <b>เฉพาะเงินที่ไม่ต้องใช้อย่างน้อย 3–5 ปี</b> — เงินที่หายได้โดยไม่กระทบชีวิต',
      reality2: 'มี <b>เงินสำรองฉุกเฉิน 3–6 เดือน</b> ก่อนเริ่มเสมอ',
      reality3: '<b>ห้ามเด็ดขาด</b>: เอาเงินค่ากิน ค่าเช่า เงินกู้ หรือเงินที่ต้องใช้เร็วๆ มาเทรด',
      reality4: 'การเทรดหุ้น <b>ไม่ใช่รายได้เสริมที่มั่นคง/เร็ว</b> — มือใหม่ส่วนใหญ่ขาดทุนปีแรก โดยเฉพาะตอนร้อนเงิน',
      realityCta: 'ถ้าตอนนี้เงินตึงและอยากได้เงินงอกแบบเสี่ยงต่ำ วิธีที่ปลอดภัยกว่าเก็งหุ้นรายตัวมากคือ <b>ทยอยลงทุนกองทุนดัชนี (DCA)</b> — <a href="invest-global-fund.html">ลองเครื่องวางแผนกองทุน S&amp;P500 →</a>',
      stockNewsDefault: 'ข่าวหุ้น', stockNewsWithSym: 'ข่าวหุ้น {sym}', stockNewsPrompt: 'ดึงราคาหุ้นในแท็บ "ภาพรวม" ก่อน เพื่อดูข่าวของหุ้นตัวนั้น',
      oppdayLinkText: 'Opportunity Day ↗',

      liveReal: 'สด / Real-time', liveFallback: 'สำรอง / Historical', liveNoConn: 'แหล่งข้อมูลสดยังเชื่อมต่อไม่ได้ · ใช้ราคาย้อนหลังเป็น fallback', liveYahooMeta: 'ใช้ Yahoo สำหรับกราฟย้อนหลัง',
      liveModePrefix: 'โหมดข้อมูล: ', updatedAt: 'อัปเดต ', liveHistorical: 'ย้อนหลัง / Historical',
      settingsSaved: 'บันทึกการตั้งค่าแล้ว · ระบบจะดึงข้อมูลตามช่วงเวลาที่ตั้ง', apiKeyCleared: 'ล้าง API Key จากเครื่องแล้ว',
      typeSymFirst: 'พิมพ์ชื่อย่อหุ้นก่อน เช่น PTT', fetchingData: 'กำลังดึงข้อมูล {sym}…',
      latestPriceMsg: 'ราคาล่าสุด {price} บาท · {source} · {time}',
      liveFromMsg: 'ราคา {sym} สดจาก {source} · กราฟย้อนหลัง {days} วัน',
      staleDataMsg: 'แหล่งข้อมูลสดใช้ไม่ได้ · ใช้ข้อมูลย้อนหลังที่บันทึกไว้ ({age}) · {days} วัน',
      histFromMsg: 'ขณะนี้ใช้ราคาย้อนหลังจาก {source} · {days} วัน',
      notFoundMsg: 'ไม่พบข้อมูลของ {sym} — ตรวจชื่อหุ้นหรือการเชื่อมต่อข้อมูลตลาด',
      enterPriceFirst: 'กรอกอย่างน้อย "ราคาตอนนี้" ก่อนนะครับ', chartLibFail: 'โหลดไลบรารีกราฟไม่ได้ (ลองออนไลน์แล้วรีเฟรช) — ส่วนไฟจราจร/คำนวณเงินยังใช้ได้',
      pasteAtLeast5: 'วางราคาปิดอย่างน้อย 5 วันก่อนนะครับ', pastedMsg: 'ใช้ราคาที่วางแล้ว ({days} วัน)',
      demoMsg: 'กำลังแสดง "ข้อมูลตัวอย่าง" (ไม่ใช่ราคาจริง) — ไว้ลองเล่นกราฟและฝึกอ่าน',
      demoBadge: 'ข้อมูลตัวอย่าง — ไม่ใช่ราคาจริง (ไว้ฝึกอ่านกราฟ)', pastedBadge: 'ราคาที่วางเอง · {days} วัน', realBadgeLabel: 'ราคาจริง', realBadge: '{label} · {status} · {days} วัน', staleLatestPrice: 'ราคาล่าสุด {age}',
      justNow: 'เมื่อสักครู่', minsAgo: '{n} นาทีก่อน', hrsAgo: '{n} ชม.ก่อน', daysAgo: '{n} วันก่อน',
      legendOpen: 'เปิด', legendHigh: 'สูง', legendLow: 'ต่ำ', legendClose: 'ปิด',
      detEma20: 'เส้นเฉลี่ย 20 วัน (EMA20)', detEma50: 'เส้นเฉลี่ย 50 วัน (EMA50)', detRsi: 'RSI (14)', detMacd: 'MACD histogram',
      detBbUp: 'กรอบบน (Bollinger)', detBbLo: 'กรอบล่าง (Bollinger)', detAtr: 'ATR (ความผันผวน)', detSupport: 'แนวรับล่าสุด', detResistance: 'แนวต้านล่าสุด',
      detAdx: 'ความแรงแนวโน้ม (ADX 14)', detAdxStrong: ' · แข็งแรง', detAdxWeak: ' · อ่อน',
      detSar: 'จุดตัดขาดทุนตาม (Parabolic SAR)', detSarUp: ' · เทรนด์ขึ้น', detSarDn: ' · เทรนด์ลง',
      vGood: 'น่าสนใจ — ลองพิจารณา', vBad: 'ระวัง — ยังไม่ใช่จังหวะ', vWait: 'รอก่อน — ยังไม่มีจังหวะเด่น',
      vExpensive: 'ระวัง — ราคาค่อนข้างแพง', vMid: 'รอก่อน — ราคากลางกรอบ',
      whyCheap: 'ราคาอยู่ช่วงถูกเทียบ 3 เดือน', whyExpensive: 'ราคาอยู่ช่วงแพงเทียบ 3 เดือน',
      whySellEase: 'แรงขายเริ่มคลาย (RSI ต่ำ กำลังฟื้น)', whyHot: 'ราคาร้อนแรงเกินไป (RSI สูง เสี่ยงย่อ)',
      whyMomUp: 'โมเมนตัมเริ่มกลับเป็นบวก', whyMomDn: 'โมเมนตัมเริ่มอ่อนลง',
      whyUptrend: 'ยังอยู่ในแนวโน้มขึ้น', whyDowntrend: 'อยู่ใต้เส้นแนวโน้ม (ขาลง/พักตัว)',
      whyLowerBand: 'ราคาแตะกรอบล่าง (มักเป็นจังหวะเด้ง)', whyUpperBand: 'ราคาชนกรอบบน',
      whyMidRange: 'ราคาอยู่กลางกรอบ ยังไม่มีสัญญาณชัด',
      whyCheapPct: 'ราคาอยู่ค่อนไปทางถูกของรอบ (~{pct}% ของช่วง ต่ำ→สูง)', whyExpensivePct: 'ราคาอยู่ค่อนไปทางแพงของรอบ (~{pct}% ของช่วง ต่ำ→สูง)', whyMidPct: 'ราคาอยู่กลางกรอบ (~{pct}% ของช่วง ต่ำ→สูง)',
      gapNeedInfo: 'กรอกราคาสูง/ต่ำของรอบ เพื่อประเมินถูก-แพง', gapNeedInfoWhy: 'หรือกด "ดูกราฟตัวอย่าง (ฝึกอ่าน)" เพื่อลองเล่นกราฟ — ตอนนี้ทำได้เฉพาะคำนวณเงินด้านล่าง',
      stopMustBeLower: 'ราคาตัดขาดทุนต้องต่ำกว่าราคาเข้าซื้อ', minLotNote: 'ขั้นต่ำ 100 หุ้น ทำให้ความเสี่ยงเกิน {pct}% ที่ตั้งไว้เล็กน้อย — พิจารณาขยับ stop ให้แคบลง หรือเพิ่มทุน',
      capitalLimitNote: 'จำกัดจำนวนตามเงินที่มี (ทุนไม่พอซื้อเท่าที่ความเสี่ยงอนุญาต)',
      calcHeadline: 'ควรซื้อได้ประมาณ <b>{shares} หุ้น</b> ({lots} ล็อต) ใช้เงิน ≈ <b>฿{cost}</b>',
      kvRiskIfWrong: 'ถ้าผิดทาง (แตะ Stop) เสียไม่เกิน', kvStopPrice: 'ราคาตัดขาดทุน (Stop)', kvCommRoundtrip: 'ค่าคอมฯ จริงไป-กลับ',
      kvBreakeven: 'ราคาคุ้มทุน (รวมค่าคอมฯ ไป-กลับ)', kvRR: 'ความคุ้ม (กำไรคาดหวัง : ความเสี่ยง) ถึงแนวต้าน',
      tpLot1: 'ทยอยขายไม้ 1: {price}', tpLot2: 'ไม้ 2: {price}', tpLot3: 'ไม้ 3: {price}',
      commMinNote: 'ℹ️ ไม้นี้เล็กเกินกว่าค่าคอมฯ ตามเปอร์เซ็นต์จะถึงขั้นต่ำ — โบรกจึงเก็บขั้นต่ำ ฿{min}/วัน แทน ทำให้ค่าคอมฯ จริงคิดเป็น {pct}% ไป-กลับ ต้องขึ้นถึง {breakeven} บาทถึงจะเท่าทุนจริง — ลองซื้อไม้ใหญ่ขึ้นเพื่อเฉลี่ยค่าคอมฯ ให้ถูกลง',
      trendUpAdx: 'อยู่ในแนวโน้มขึ้น (ราคาเหนือเส้นเฉลี่ย)', trendNotUpAdx: 'ยังไม่อยู่ในแนวโน้มขึ้น (ราคาใต้เส้นเฉลี่ย)', adxStrongTxt: ' · ADX {adx} เทรนด์แข็งแรง', adxWeakTxt: ' · ADX {adx} เทรนด์อ่อน ควรระวัง',
      notChasing: 'ไม่ไล่ราคา (ห่างเส้นเฉลี่ย 20 ไม่เกิน 5%)', chasing: 'กำลังไล่ราคา (สูงกว่าเส้นเฉลี่ย 20 เกิน 5%)',
      needChartFirst: 'แนวโน้ม/การไล่ราคา: ต้องมีข้อมูลกราฟก่อน (กด "ดึงราคา" หรือ "ดูกราฟตัวอย่าง")',
      rsiOk: 'ไม่ร้อนแรงเกิน (RSI {rsi})', rsiHot: 'ร้อนแรงเกินไป (RSI {rsi} ≥ 70) เสี่ยงย่อ', rsiNeedChart: 'RSI: ต้องมีข้อมูลกราฟก่อน',
      stopSetOk: 'ตั้งจุดตัดขาดทุน (Stop) แล้ว', stopNotSet: 'ยังไม่ตั้งจุดตัดขาดทุน — กด "คำนวณ" ในขั้นที่ 2 ก่อน',
      riskOk: 'เสี่ยงต่อไม้ ≤ 2% ({pct}%)', riskHigh: 'เสี่ยงต่อไม้สูงไป ({pct}) — ควร ≤ 2%',
      rrOk: 'กำไรคาดหวัง:เสี่ยง ≥ 2:1 ({rr}:1)', rrLow: 'กำไร:เสี่ยงน้อยไป ({rr}:1) — ควร ≥ 2:1', rrNeedInfo: 'กำไร:เสี่ยง: ต้องมีแนวต้านจากกราฟ + ตั้ง Stop ก่อน',
      checklistFail: 'ยังไม่ควรเข้า — ติด {n} ข้อ ควรแก้ให้ครบก่อนซื้อ', checklistUnknown: 'ข้อมูลไม่พอประเมินครบ — กด "ประเมิน"/"ดึงราคา" แล้ว "คำนวณ" ก่อน',
      checklistGo: 'เข้าได้ตามแผน — ผ่านครบทุกข้อ (แต่ยังไม่การันตีกำไร ทำตามแผนและตัดขาดทุนเสมอ)',
      expInvalid: 'กรอกตัวเลขให้ครบ (อัตราชนะ 0–100%, กำไร/ขาดทุนเป็นเท่าของ R)',
      expMsg: 'ค่าคาดหวังต่อไม้ ≈ <b>{sign}{exp} R</b> (ถ้าเสี่ยงไม้ละ 1,000 บาท ≈ {sign2}฿{bahtExp} ต่อไม้โดยเฉลี่ย)<br><span style="font-weight:500">ต้องชนะอย่างน้อย ~{beWin}% ถึงจะเสมอตัวที่ R นี้</span>',
      expGood: 'ได้เปรียบระยะยาว<br>{msg}<br><span style="font-weight:500">ถ้าทำตามวินัยสม่ำเสมอ (คุมความเสี่ยงเท่ากันทุกไม้) มีโอกาสกำไรระยะยาว</span>',
      expBreakeven: 'แทบเสมอตัว<br>{msg}<br><span style="font-weight:500">หักค่าคอมฯแล้วอาจขาดทุน — ต้องเพิ่มกำไรตอนชนะ หรือลดขาดทุนตอนแพ้</span>',
      expBad: 'ขาดทุนระยะยาว<br>{msg}<br><span style="font-weight:500">ถึงชนะบ่อยก็ไม่พอ — ต้อง "ปล่อยกำไรให้ยาว ตัดขาดทุนให้ไว" (เพิ่ม R ตอนชนะ)</span>',
      sellSarDn: 'พิจารณาขาย — สัญญาณเทรนด์กลับตัว (SAR พลิกลง)', sellBelowTrend: 'พิจารณาขาย/ตัดขาดทุน — ราคาหลุดแนวโน้ม (ต่ำกว่าเส้นค่าเฉลี่ย)',
      sellHotRsi: 'พิจารณาล็อกกำไรบางส่วน — RSI สูง ราคาร้อนแรง อาจย่อ', sellNearResist: 'ใกล้แนวต้าน — พิจารณาล็อกกำไรบางส่วน',
      sellHold: 'ยังอยู่ในแนวโน้มขึ้น — ถือต่อได้ เลื่อนจุดตัดขาดทุนตามแนวด้านล่าง',
      sarLabel: 'แนวตัดขาดทุนตามเทรนด์ (SAR)', sarNoData: 'ข้อมูลไม่พอคำนวณ (ต้องมีประวัติราคาอย่างน้อย ~3 วัน)',
      sarUpReason: 'ถ้าราคาปิดหลุดต่ำกว่า {price} ถือว่าเทรนด์ขาขึ้นเริ่มกลับตัว', sarDnReason: 'ราคาหลุดแนวนี้ไปแล้ว (SAR พลิกลง) — เป็นสัญญาณเตือนที่ชัดที่สุด',
      stopRiskLabel: 'จุดตัดขาดทุนตามความเสี่ยง (ATR/แนวรับ)', noData: 'ข้อมูลไม่พอคำนวณ',
      stopRiskReason: 'กันขาดทุนหนักถ้าราคาหลุดแนวรับหรือผันผวนเกินค่าเฉลี่ย{atr}', atrSuffix: ' (ATR ≈ {atr})',
      ema20Label: 'เส้นค่าเฉลี่ย 20 วัน (สัญญาณเตือนแรก)', ema20Reason: 'หลุดเส้นนี้มักเป็นสัญญาณเริ่มอ่อนตัว — ยังไม่ใช่จุดตัดขาดทุนหลัก แต่ควรเริ่มระวัง',
      resistLabel: 'แนวต้าน (จุดพิจารณาล็อกกำไรบางส่วน)', resistReason: 'ราคามักเจอแรงขายทำกำไรบริเวณนี้ พิจารณาขายบางส่วนหรือเลื่อนจุดตัดขาดทุนตามเพื่อป้องกันกำไร',
      noCompanyInfo: 'ไม่มีข้อมูลบริษัทในฐานข้อมูล', companyInfoFallback: 'รองรับเฉพาะ 50 หุ้นใน SET50 — <a href="{url}" target="_blank" rel="noopener">ค้นหาข้อมูลบริษัท {sym} เอง ↗</a>',
      alertEnterSym: 'ใส่ชื่อหุ้นก่อน', alertEnterValid: 'กรอกจำนวนหุ้นและราคาต้นทุนให้ถูกต้อง',
      fetchingSellPrice: 'กำลังดึงราคา {sym}…', sellFetchFail: 'ดึงราคา {sym} ไม่ได้ตอนนี้ — ลองใหม่อีกครั้ง หรือกรอกราคาปัจจุบันเองในช่อง',
      sellLatestPrice: 'ราคาล่าสุด {price}', sellSavedAge: ' (บันทึกไว้ {age})', sellCostLabel: ' · ต้นทุน {cost} · ', sellProfit: 'กำไร ', sellLoss: 'ขาดทุน ',
      searchNewsMyself: 'ค้นหาข่าวเอง ↗', searchingNews: 'กำลังค้นข่าว {sym}… ', moreNews: 'ดูข่าวเพิ่มเติม ', newsAutoFail: 'ดึงข่าวอัตโนมัติไม่ได้ตอนนี้ ',
      scannerLink: 'สแกนเนอร์ SET50',
      iosNotSupported: 'ฟีเจอร์นี้ (AI รันในเครื่อง) ยังไม่รองรับ iPhone/iPad ตอนนี้ — หน่วยความจำต่อแท็บของ Safari/iOS จำกัดเกินกว่าจะรันโมเดลได้อย่างเสถียร ลองใช้งานจากคอมพิวเตอร์แทนได้ครับ',
      needStockData: 'ยังไม่มีข้อมูลหุ้นให้สรุป — ดึงราคาหรือดูกราฟตัวอย่างก่อนนะครับ',
      summarizing: 'กำลังสรุป… (ครั้งแรกอาจต้องโหลดโมเดล AI ~350MB ก่อน)', loadingModel: 'กำลังโหลดโมเดล (ครั้งแรกเท่านั้น) {file} {pct}',
      summarizeFail: 'สรุปไม่สำเร็จ ลองอีกครั้ง', summarizeFailWith: 'สรุปไม่สำเร็จ: {msg}', unknownReason: 'ไม่ทราบสาเหตุ',
      memErrorMsg: 'โหลดโมเดล AI ไม่สำเร็จ เพราะหน่วยความจำที่เบราว์เซอร์เหลือให้ใช้ไม่พอ (มักเกิดถ้าเปิดแท็บ/โปรแกรมอื่นพร้อมกันเยอะ) ลองปิดแท็บ/โปรแกรมอื่นแล้วกดสรุปใหม่อีกครั้ง',
      diskErrorMsg: 'บันทึกไฟล์โมเดล AI ไม่สำเร็จ เพราะพื้นที่จัดเก็บของเบราว์เซอร์สำหรับเว็บไซต์นี้เต็ม (คนละเรื่องกับโปรแกรม/แท็บอื่นที่เปิดอยู่) ลองล้างข้อมูลเว็บไซต์นี้ในเบราว์เซอร์ หรือเพิ่มพื้นที่ว่างในดิสก์แล้วลองใหม่',
      thisStock: 'หุ้นนี้', sampleWord: 'ตัวอย่าง', enterEntryFirst: 'กรอกราคาเข้าซื้อ (หรือราคาตอนนี้) ก่อน',
      ctxStock: 'หุ้น: {v}', ctxLatestPrice: 'ราคาล่าสุด: {v} บาท', ctxVerdict: 'สัญญาณไฟจราจรที่คำนวณแล้ว: {v} ({why})',
      ctxPros: 'ปัจจัยหนุนที่ตรวจพบ: {v}', ctxCons: 'ปัจจัยเสี่ยงที่ตรวจพบ: {v}',
      ctxRsi: 'RSI (14 วัน): {v}', ctxRsiHigh: ' (สูง/ร้อนแรง)', ctxRsiLow: ' (ต่ำ/แรงขายเริ่มคลาย)', ctxRsiMid: ' (กลางๆ)',
      ctxMacd: 'MACD histogram: {v}', ctxMacdPos: ' (เป็นบวก)', ctxMacdNeg: ' (เป็นลบ)',
      ctxEma: 'เส้นเฉลี่ย 20 วัน: {e20}, เส้นเฉลี่ย 50 วัน: {e50}', ctxEmaUp: ' (ราคาอยู่เหนือเส้นเฉลี่ย — แนวโน้มขึ้น)', ctxEmaDn: ' (ราคาอยู่ใต้เส้นเฉลี่ย — แนวโน้มลง/พักตัว)',
      ctxSupport: 'แนวรับล่าสุด: {v}', ctxResistance: 'แนวต้านล่าสุด: {v}',
      ctxAdx: 'ความแรงแนวโน้ม (ADX): {v}', ctxAdxStrong: ' (แข็งแรง)', ctxAdxWeak: ' (อ่อน)',
      ctxNewsWithCount: 'หัวข้อข่าวล่าสุด ({n} ข่าว): {v}', ctxNoNews: 'หัวข้อข่าวล่าสุด: ไม่มีข้อมูลข่าว'
    },
    en: {
      navOverview: 'Overview', navMyPortfolio: 'My Portfolio', navMarket: 'Markets & Assets', navLottery: 'Lottery & Bonds', navNews: 'News & Business',
      crumbHome: 'Investing', crumbHere: 'Thai Stocks', pageDefaultTitle: 'Thai Stocks — Entry/Exit Helper', whyTitleDefault: 'Reason for signal', tabNews: 'News & Calendar',
      defaultSignal: 'Signal —', defaultSector: 'Thai stock',
      step1Title: 'Current stock price', symLabel: 'Ticker (e.g. PTT, ADVANC)', fetchBtn: 'Try Fetching Price',
      priceNowLabel: 'Current price (THB)', priceNowPh: 'e.g. 35.50', priceHiLabel: 'Period high', priceLoLabel: 'Period low', periodPh: 'Last 3 months',
      liveModeHistorical: 'Data mode: Historical', liveMetaDefault: 'Set up a live data source in "Market Data Settings"',
      refreshBtn: '↻ Refresh', marketSettingsBtn: '⚙ Market Data Settings',
      marketSettingsTitle: 'Live Market Data', providerLabel: 'Data source', providerGateway: 'Tanot Data Gateway (recommended)', providerYahoo: 'Yahoo / Historical',
      apiKeyLabel: 'Twelve Data API Key', apiKeyNote: '(stored locally only)', apiKeyPh: 'Enter if you have an API key',
      intervalLabel: 'Refresh every', interval5: '5 seconds', interval10: '10 seconds', interval30: '30 seconds',
      saveSettingsBtn: 'Save Settings', clearApiKeyBtn: 'Clear API Key',
      analyzeBtn: 'Analyze It', demoBtn: 'View Sample Chart (Practice)',
      pasteSummary: 'Paste historical prices manually (optional)', pasteHint: 'Paste several days of closing prices, separated by space/line/comma (oldest→newest)', pasteBtn: 'Use This Price',
      chartTitle: 'Price Chart', tf1m: '1mo', tf3m: '3mo', tf6m: '6mo', tf1y: '1yr', tgMa20: 'MA 20', tgMa50: 'MA 50',
      capUp: 'Up candle', capDn: 'Down candle', capMa20: '20-day average', capMa50: '50-day average', capTouch: 'Tap the chart to see each day’s price',
      techDetailsSummary: 'View technical details (no need to understand)',
      aiSumTitle: 'AI Stock Summary', aiSumBtn: 'Summarize It',
      step2Title: 'How much to invest, and where to sell',
      capitalLabel: 'Total portfolio capital (THB)', capitalPh: 'e.g. 100000', riskPctLabel: 'Risk per trade', unitPctPortfolio: '(% of portfolio)',
      entryLabel: 'Entry price (THB)', entryPh: '= current price', stopLabel: 'Stop-loss price', stopPh: 'Suggested automatically',
      commLabel: 'Commission', unitPctPerTrade: '(% per trade)', commMinLabel: 'Minimum commission', unitBahtPerDay: '(THB/day)',
      calcBtn: 'Calculate', saveToPortfolioBtn: 'Save to Portfolio', savedBtn: 'Saved',
      checklistTitle: 'Pre-Trade Checklist — Should You Buy?',
      checkBtn: 'Run Checklist',
      pfTitle: 'My Portfolio (Thai Stocks)', pfSeeAll: 'See portfolio across the whole site →',
      pfSymLabel: 'Ticker', pfSharesLabel: 'Shares', pfCostLabel: 'Cost/share', pfAddBtn: '+ Add to Portfolio',
      pfEmptyDefault: 'No holdings yet',
      pfEmptyEmbed: 'No {sym} in portfolio yet',
      pfThSym: 'Stock', pfThShares: 'Shares', pfThCost: 'Cost/share', pfThCur: 'Current price', pfThPl: 'P/L',
      pfPricePh: 'Price', pfSellTitle: 'Check should I sell?', pfSellBtn: 'Should I sell?', pfDelTitle: 'Delete',
      expectancyTitle: 'Is Your Trading System "Profitable Long-Term"?',
      eWinLabel: 'Win rate', unitPctWinTrades: '(% of winning trades)', eWinRLabel: 'Average gain when winning', unitR: '(multiples of risk R)', eLossRLabel: 'Average loss when losing',
      realityTitle: 'Read Before Investing Real Money (Important)',
      reality1: 'Only invest in stocks <b>with money you won’t need for at least 3–5 years</b> — money you can afford to lose without affecting your life',
      reality2: 'Always have <b>3–6 months of emergency savings</b> before you start',
      reality3: '<b>Never</b>: use money for food, rent, loans, or money you’ll need soon to trade',
      reality4: 'Stock trading <b>is not a stable/quick side income</b> — most beginners lose money in year one, especially when trading with money they need',
      realityCta: 'If money is tight right now and you want low-risk growth, a much safer approach than picking individual stocks is <b>dollar-cost averaging into an index fund (DCA)</b> — <a href="invest-global-fund.html">try the S&amp;P 500 fund planner →</a>',
      stockNewsDefault: 'Stock News', stockNewsWithSym: '{sym} News', stockNewsPrompt: 'Fetch a stock price in the "Overview" tab first to see its news',
      oppdayLinkText: 'Opportunity Day ↗',

      liveReal: 'Live / Real-time', liveFallback: 'Fallback / Historical', liveNoConn: 'Live data source not reachable yet · using historical price as fallback', liveYahooMeta: 'Using Yahoo for historical charts',
      liveModePrefix: 'Data mode: ', updatedAt: 'updated ', liveHistorical: 'Historical',
      settingsSaved: 'Settings saved · data will refresh at the interval you set', apiKeyCleared: 'API Key cleared from this device',
      typeSymFirst: 'Type a ticker first, e.g. PTT', fetchingData: 'Fetching {sym} data…',
      latestPriceMsg: 'Latest price {price} THB · {source} · {time}',
      liveFromMsg: 'Live price for {sym} from {source} · {days} days of history',
      staleDataMsg: 'Live source unavailable · using saved historical data ({age}) · {days} days',
      histFromMsg: 'Currently using historical price from {source} · {days} days',
      notFoundMsg: 'No data found for {sym} — check the ticker or your market data connection',
      enterPriceFirst: 'Please enter at least the "current price" first', chartLibFail: 'Couldn’t load the charting library (try going online and refreshing) — the signal light/money calculator still work',
      pasteAtLeast5: 'Please paste at least 5 days of closing prices', pastedMsg: 'Using pasted price ({days} days)',
      demoMsg: 'Showing "sample data" (not real prices) — for practicing reading charts',
      demoBadge: 'Sample data — not real prices (for practicing chart reading)', pastedBadge: 'Pasted price · {days} days', realBadgeLabel: 'Real price', realBadge: '{label} · {status} · {days} days', staleLatestPrice: 'Latest price {age}',
      justNow: 'just now', minsAgo: '{n} min ago', hrsAgo: '{n} hr ago', daysAgo: '{n} days ago',
      legendOpen: 'Open', legendHigh: 'High', legendLow: 'Low', legendClose: 'Close',
      detEma20: '20-day average (EMA20)', detEma50: '50-day average (EMA50)', detRsi: 'RSI (14)', detMacd: 'MACD histogram',
      detBbUp: 'Upper band (Bollinger)', detBbLo: 'Lower band (Bollinger)', detAtr: 'ATR (volatility)', detSupport: 'Latest support', detResistance: 'Latest resistance',
      detAdx: 'Trend strength (ADX 14)', detAdxStrong: ' · strong', detAdxWeak: ' · weak',
      detSar: 'Trailing stop (Parabolic SAR)', detSarUp: ' · uptrend', detSarDn: ' · downtrend',
      vGood: 'Interesting — worth considering', vBad: 'Caution — not the right time yet', vWait: 'Wait — no standout opportunity yet',
      vExpensive: 'Caution — price is on the expensive side', vMid: 'Wait — price is mid-range',
      whyCheap: 'Price is on the cheap side of its 3-month range', whyExpensive: 'Price is on the expensive side of its 3-month range',
      whySellEase: 'Selling pressure easing (RSI low, starting to recover)', whyHot: 'Price is overheated (RSI high, risk of pullback)',
      whyMomUp: 'Momentum is turning positive', whyMomDn: 'Momentum is weakening',
      whyUptrend: 'Still in an uptrend', whyDowntrend: 'Below the trend line (downtrend/consolidation)',
      whyLowerBand: 'Price is touching the lower band (often a bounce opportunity)', whyUpperBand: 'Price is hitting the upper band',
      whyMidRange: 'Price is mid-range with no clear signal yet',
      whyCheapPct: 'Price is on the cheap side of its range (~{pct}% of low→high range)', whyExpensivePct: 'Price is on the expensive side of its range (~{pct}% of low→high range)', whyMidPct: 'Price is mid-range (~{pct}% of low→high range)',
      gapNeedInfo: 'Enter the period high/low to assess cheap-vs-expensive', gapNeedInfoWhy: 'Or click "View Sample Chart" to try the chart — for now only the money calculator below works',
      stopMustBeLower: 'Stop-loss price must be lower than the entry price', minLotNote: 'Minimum 100 shares means your risk slightly exceeds the {pct}% you set — consider tightening the stop, or adding capital',
      capitalLimitNote: 'Limited by available funds (not enough capital to buy as much as your risk setting allows)',
      calcHeadline: 'You can buy about <b>{shares} shares</b> ({lots} lots), using ≈ <b>฿{cost}</b>',
      kvRiskIfWrong: 'If wrong (stop hit), lose no more than', kvStopPrice: 'Stop-loss price', kvCommRoundtrip: 'Real round-trip commission',
      kvBreakeven: 'Breakeven price (incl. round-trip commission)', kvRR: 'Reward:risk to resistance',
      tpLot1: 'Sell lot 1: {price}', tpLot2: 'Lot 2: {price}', tpLot3: 'Lot 3: {price}',
      commMinNote: 'ℹ️ This trade is too small for the percentage commission to reach the minimum — your broker charges the ฿{min}/day minimum instead, making real commission {pct}% round-trip. Price needs to reach {breakeven} THB to truly break even — consider a bigger trade to average out the minimum commission',
      trendUpAdx: 'In an uptrend (price above moving average)', trendNotUpAdx: 'Not yet in an uptrend (price below moving average)', adxStrongTxt: ' · ADX {adx} strong trend', adxWeakTxt: ' · ADX {adx} weak trend, be careful',
      notChasing: 'Not chasing the price (within 5% of the 20-day average)', chasing: 'Chasing the price (more than 5% above the 20-day average)',
      needChartFirst: 'Trend/chase check: needs chart data first (click "Fetch Price" or "View Sample Chart")',
      rsiOk: 'Not overheated (RSI {rsi})', rsiHot: 'Overheated (RSI {rsi} ≥ 70), risk of pullback', rsiNeedChart: 'RSI: needs chart data first',
      stopSetOk: 'Stop-loss is set', stopNotSet: 'Stop-loss not set yet — click "Calculate" in step 2 first',
      riskOk: 'Risk per trade ≤ 2% ({pct}%)', riskHigh: 'Risk per trade too high ({pct}) — should be ≤ 2%',
      rrOk: 'Reward:risk ≥ 2:1 ({rr}:1)', rrLow: 'Reward:risk too low ({rr}:1) — should be ≥ 2:1', rrNeedInfo: 'Reward:risk: needs resistance from the chart + a stop set first',
      checklistFail: 'Not ready to enter — {n} item(s) failed, fix them all before buying', checklistUnknown: 'Not enough data to fully assess — click "Analyze"/"Fetch Price" then "Calculate" first',
      checklistGo: 'Ready to enter per plan — all items passed (still not a profit guarantee, follow your plan and always cut losses)',
      expInvalid: 'Please fill in all numbers (win rate 0–100%, gain/loss in multiples of R)',
      expMsg: 'Expected value per trade ≈ <b>{sign}{exp} R</b> (if risking 1,000 THB per trade ≈ {sign2}฿{bahtExp} per trade on average)<br><span style="font-weight:500">You need to win at least ~{beWin}% to break even at this R</span>',
      expGood: 'Positive edge long-term<br>{msg}<br><span style="font-weight:500">If you follow discipline consistently (same risk per trade), you have a chance at long-term profit</span>',
      expBreakeven: 'Nearly break-even<br>{msg}<br><span style="font-weight:500">After commissions you may lose money — you need bigger wins, or smaller losses</span>',
      expBad: 'Losing long-term<br>{msg}<br><span style="font-weight:500">Even winning often isn’t enough — you need to "let profits run, cut losses fast" (increase R when winning)</span>',
      sellSarDn: 'Consider selling — trend reversal signal (SAR flipped down)', sellBelowTrend: 'Consider selling/cutting loss — price broke below trend (below moving average)',
      sellHotRsi: 'Consider locking in partial profit — RSI high, price overheated, may pull back', sellNearResist: 'Near resistance — consider locking in partial profit',
      sellHold: 'Still in an uptrend — can keep holding, trail your stop along the levels below',
      sarLabel: 'Trend-following stop (SAR)', sarNoData: 'Not enough data to calculate (needs at least ~3 days of price history)',
      sarUpReason: 'If price closes below {price}, the uptrend is considered to be reversing', sarDnReason: 'Price has already broken this level (SAR flipped down) — the clearest warning signal',
      stopRiskLabel: 'Risk-based stop-loss (ATR/support)', noData: 'Not enough data to calculate',
      stopRiskReason: 'Limits heavy losses if price breaks support or is more volatile than average{atr}', atrSuffix: ' (ATR ≈ {atr})',
      ema20Label: '20-day moving average (early warning)', ema20Reason: 'Breaking below this line is often an early weakening signal — not the main stop, but worth watching',
      resistLabel: 'Resistance (consider partial profit-taking)', resistReason: 'Price often meets profit-taking selling pressure here — consider selling part of the position or trailing your stop to protect gains',
      noCompanyInfo: 'No company info in the database', companyInfoFallback: 'Only 50 SET50 stocks are supported — <a href="{url}" target="_blank" rel="noopener">search for {sym} company info yourself ↗</a>',
      alertEnterSym: 'Enter a ticker first', alertEnterValid: 'Enter a valid share count and cost',
      fetchingSellPrice: 'Fetching {sym} price…', sellFetchFail: 'Couldn’t fetch {sym} price right now — try again, or enter the current price yourself',
      sellLatestPrice: 'Latest price {price}', sellSavedAge: ' (saved {age})', sellCostLabel: ' · cost {cost} · ', sellProfit: 'profit ', sellLoss: 'loss ',
      searchNewsMyself: 'Search news myself ↗', searchingNews: 'Searching news for {sym}… ', moreNews: 'More news ', newsAutoFail: 'Couldn’t auto-fetch news right now ',
      scannerLink: 'SET50 Scanner',
      iosNotSupported: 'This feature (on-device AI) isn’t supported on iPhone/iPad yet — Safari/iOS per-tab memory is too limited to run the model reliably. Try from a computer instead',
      needStockData: 'No stock data to summarize yet — fetch a price or view the sample chart first',
      summarizing: 'Summarizing… (first time may need to download the ~350MB AI model)', loadingModel: 'Loading model (first time only) {file} {pct}',
      summarizeFail: 'Summary failed, try again', summarizeFailWith: 'Summary failed: {msg}', unknownReason: 'unknown reason',
      memErrorMsg: 'Failed to load the AI model because the browser doesn’t have enough free memory (usually from having many tabs/programs open at once). Try closing other tabs/programs and summarizing again',
      diskErrorMsg: 'Failed to save the AI model file because this site’s browser storage is full (unrelated to other open tabs/programs). Try clearing this site’s data in your browser, or free up disk space, then try again',
      thisStock: 'this stock', sampleWord: 'Sample', enterEntryFirst: 'Enter the entry price (or current price) first',
      ctxStock: 'Stock: {v}', ctxLatestPrice: 'Latest price: {v} baht', ctxVerdict: 'Computed signal: {v} ({why})',
      ctxPros: 'Detected tailwinds: {v}', ctxCons: 'Detected risks: {v}',
      ctxRsi: 'RSI (14-day): {v}', ctxRsiHigh: ' (high/overheated)', ctxRsiLow: ' (low/selling pressure easing)', ctxRsiMid: ' (neutral)',
      ctxMacd: 'MACD histogram: {v}', ctxMacdPos: ' (positive)', ctxMacdNeg: ' (negative)',
      ctxEma: '20-day MA: {e20}, 50-day MA: {e50}', ctxEmaUp: ' (price above the MAs — uptrend)', ctxEmaDn: ' (price below the MAs — downtrend/consolidation)',
      ctxSupport: 'Latest support: {v}', ctxResistance: 'Latest resistance: {v}',
      ctxAdx: 'Trend strength (ADX): {v}', ctxAdxStrong: ' (strong)', ctxAdxWeak: ' (weak)',
      ctxNewsWithCount: 'Latest headlines ({n} articles): {v}', ctxNoNews: 'Latest headlines: no news data'
    }
  };
  function t(key, vars) {
    var s = (I18N[getUILang()] || I18N.th)[key]; if (s == null) s = I18N.th[key] || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  }
  function applyStaticI18n() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) { el.innerHTML = t(el.getAttribute('data-i18n-html')); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) { el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder'))); });
  }

  /* หน้านี้เปิดเป็นป๊อปอัพ (iframe) จาก invest.html ได้ด้วย ?embed=1&sym=XXX — โฟกัสเฉพาะหุ้นตัวนั้น
     ตัวเดียว: การ์ด "พอร์ตของฉัน (หุ้นไทย)" ด้านล่างจะกรองให้เห็นแค่ตำแหน่งของสัญลักษณ์นี้ (ดู renderPf) */
  var EMBED_SYM = null;
  if (new URLSearchParams(location.search).get('embed')) {
    document.body.classList.add('embedded');
    EMBED_SYM = (new URLSearchParams(location.search).get('sym') || '').trim().toUpperCase() || null;
  }

  /* พอร์ต (หุ้นไทย) — เก็บ+สำรองผ่านโมดูลกลาง invest-drivesync.js (ใช้ร่วมกับสมุดเทรดในหน้าแยก) */
  var loadPf = window.InvestDrive.loadPf, savePf = window.InvestDrive.savePf, DriveSync = window.InvestDrive.DriveSync;

  /* ── อินดิเคเตอร์ (สูตรมาตรฐาน) ─────────────────────────────── */
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
  function rsiSeries(arr, n) {
    n = n || 14; var out = new Array(arr.length);
    if (arr.length < n + 1) return out;
    var gain = 0, loss = 0, i, ch;
    for (i = 1; i <= n; i++) { ch = arr[i] - arr[i - 1]; if (ch >= 0) gain += ch; else loss -= ch; }
    var ag = gain / n, al = loss / n;
    out[n] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
    for (i = n + 1; i < arr.length; i++) {
      ch = arr[i] - arr[i - 1];
      ag = (ag * (n - 1) + (ch > 0 ? ch : 0)) / n;
      al = (al * (n - 1) + (ch < 0 ? -ch : 0)) / n;
      out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
    }
    return out;
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

  /* ADX(14) — ความแรงของแนวโน้ม (>20-25 = เทรนด์ชัด) */
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

  /* Parabolic SAR — จุดตัดขาดทุนตามเทรนด์ (ใช้เป็น trailing stop / สัญญาณพลิก) */
  function psar(highs, lows, step, maxAf) {
    step = step || 0.02; maxAf = maxAf || 0.2;
    var n = highs.length; if (n < 3) return null;
    var sar = lows[0], ep = highs[0], af = step, up = true, i;
    for (i = 1; i < n; i++) {
      sar = sar + af * (ep - sar);
      if (up) {
        if (lows[i] < sar) { up = false; sar = ep; ep = lows[i]; af = step; }
        else if (highs[i] > ep) { ep = highs[i]; af = Math.min(maxAf, af + step); }
      } else {
        if (highs[i] > sar) { up = true; sar = ep; ep = highs[i]; af = step; }
        else if (lows[i] < ep) { ep = lows[i]; af = Math.min(maxAf, af + step); }
      }
    }
    return { sar: sar, up: up };
  }

  /* ── วิเคราะห์ (มีซีรีส์เต็ม) → ไฟจราจร ─────────────────────── */
  function analyzeSeries(s) {
    var c = s.closes, price = c[c.length - 1];
    var ema20 = emaLast(c, 20), ema50 = emaLast(c, 50), r = rsi(c, 14);
    var mac = macd(c), bb = bollinger(c, 20, 2), at = atr(s.highs, s.lows, c, 14);
    var sr = supRes(s.highs, s.lows, 20);
    var adxV = adx(s.highs, s.lows, c, 14), ps = psar(s.highs, s.lows);
    var range = { hi: Math.max.apply(null, c), lo: Math.min.apply(null, c) };
    var posRange = (price - range.lo) / Math.max(1e-9, range.hi - range.lo);
    var posBB = bb ? (price - bb.lower) / Math.max(1e-9, bb.upper - bb.lower) : 0.5;
    var uptrend = isFinite(ema50) ? price >= ema50 : (isFinite(ema20) ? price >= ema20 : true);
    var momUp = mac && isFinite(mac.hist) && isFinite(mac.histPrev) ? mac.hist > mac.histPrev : false;
    var momDn = mac && isFinite(mac.hist) && isFinite(mac.histPrev) ? mac.hist < mac.histPrev : false;

    var score = 0, pros = [], cons = [];
    if (posRange < 0.35) { score += 1; pros.push(t('whyCheap')); }
    else if (posRange > 0.75) { score -= 1; cons.push(t('whyExpensive')); }
    if (isFinite(r)) {
      if (r < 38) { score += 1; pros.push(t('whySellEase')); }
      else if (r > 70) { score -= 1; cons.push(t('whyHot')); }
    }
    if (momUp) { score += 1; pros.push(t('whyMomUp')); }
    else if (momDn) { score -= 1; cons.push(t('whyMomDn')); }
    if (uptrend) { score += 1; pros.push(t('whyUptrend')); }
    else { score -= 1; cons.push(t('whyDowntrend')); }
    if (posBB < 0.2) { score += 0.5; pros.push(t('whyLowerBand')); }
    else if (posBB > 0.9) { score -= 0.5; cons.push(t('whyUpperBand')); }

    var light, verdict;
    if (score >= 2) { light = 'green'; verdict = t('vGood'); }
    else if (score <= -1) { light = 'red'; verdict = t('vBad'); }
    else { light = 'yellow'; verdict = t('vWait'); }
    var why = (light === 'green' ? pros : light === 'red' ? cons : (pros.concat(cons)))[0] || t('whyMidRange');

    var stopByAtr = isFinite(at) ? price - 1.5 * at : NaN;
    var stopBySup = isFinite(sr.support) ? sr.support * 0.99 : NaN;
    var stop = NaN;
    if (isFinite(stopBySup) && stopBySup < price) stop = stopBySup;
    if (isFinite(stopByAtr) && stopByAtr < price && (!isFinite(stop) || stopByAtr > stop)) stop = stopByAtr;
    if (!isFinite(stop) || stop <= 0) stop = price * 0.95;

    return {
      light: light, verdict: verdict, why: why, pros: pros, cons: cons, score: score,
      price: price, suggestStop: stop, resistance: sr.resistance,
      uptrend: uptrend, rsi: r, adx: adxV, psar: ps,
      det: { ema20: ema20, ema50: ema50, rsi: r, macdHist: mac ? mac.hist : NaN,
             bbUpper: bb ? bb.upper : NaN, bbLower: bb ? bb.lower : NaN, atr: at,
             support: sr.support, resistance: sr.resistance, posRange: posRange,
             adx: adxV, psar: ps }
    };
  }

  function analyzeSimple(price, hi, lo) {
    var pos = (price - lo) / Math.max(1e-9, hi - lo), pct = Math.round(pos * 100);
    var light, verdict, why;
    if (pos < 0.35) { light = 'green'; verdict = t('vGood'); why = t('whyCheapPct', { pct: pct }); }
    else if (pos > 0.75) { light = 'red'; verdict = t('vExpensive'); why = t('whyExpensivePct', { pct: pct }); }
    else { light = 'yellow'; verdict = t('vMid'); why = t('whyMidPct', { pct: pct }); }
    return { light: light, verdict: verdict, why: why, pros: [], cons: [], price: price, suggestStop: Math.min(lo, price * 0.95), resistance: hi, det: { posRange: pos, support: lo, resistance: hi }, simple: true };
  }

  /* ── คุมเงิน/ความเสี่ยง ─────────────────────────────────────── */
  function riskCalc(o) {
    var capital = o.capital, riskPct = o.riskPct, entry = o.entry, stop = o.stop, comm = o.comm / 100;
    var commMin = isFinite(o.commMin) && o.commMin >= 0 ? o.commMin : 50;
    var perShare = entry - stop;
    if (!(perShare > 0)) return { error: t('stopMustBeLower') };
    var riskBudget = capital * riskPct / 100;
    var shares = Math.floor(riskBudget / perShare / 100) * 100, note = '';
    if (shares < 100) { shares = 100; note = t('minLotNote', { pct: riskPct }); }
    var cost = shares * entry;
    if (cost > capital) {
      var maxLots = Math.floor(capital / entry / 100) * 100;
      if (maxLots >= 100) { shares = maxLots; cost = shares * entry; note = t('capitalLimitNote'); }
    }
    var R = perShare;
    /* ค่าคอมฯ ต่อขา = max(มูลค่า × %, ขั้นต่ำ/วัน) — โบรกไทยส่วนใหญ่คิดขั้นต่ำ ~50 บาท/วัน
       ไม้เล็กที่ค่าคอมฯ ตามเปอร์เซ็นต์ยังไม่ถึงขั้นต่ำ จะโดนเก็บที่ขั้นต่ำแทน ทำให้ค่าคอมฯ จริงแพงกว่าอัตราปกติมาก
       ประมาณขาขายจากมูลค่าซื้อ (ราคาปิดไม้จริงต่างออกไปได้เล็กน้อย) */
    var buyComm = Math.max(cost * comm, commMin), sellComm = Math.max(cost * comm, commMin), totalComm = buyComm + sellComm;
    var breakeven = shares > 0 ? entry + totalComm / shares : entry;
    var commPct = cost > 0 ? totalComm / cost * 100 : 0, minKicksIn = cost * comm < commMin;
    var rr = isFinite(o.resistance) && o.resistance > entry ? (o.resistance - entry) / R : NaN;
    return { shares: shares, lots: shares / 100, cost: cost, riskBaht: shares * perShare, tp1: entry + R, tp2: entry + 2 * R, tp3: entry + 3 * R, breakeven: breakeven, commBaht: totalComm, commPct: commPct, minKicksIn: minKicksIn, rr: rr, riskBudget: riskBudget, note: note };
  }

  /* ── สร้างชุดข้อมูล (ใช้ร่วมทั้งกราฟ + วิเคราะห์) ─────────────── */
  function daysAgoDates(n) {
    var out = [], d = new Date(); d.setHours(0, 0, 0, 0);
    for (var i = n - 1; i >= 0; i--) { var x = new Date(d); x.setDate(d.getDate() - i); out.push(x.toISOString().slice(0, 10)); }
    return out;
  }
  function toSeries(times, opens, highs, lows, closes, volumes) {
    function align(a) { var r = [], i; for (i = 0; i < times.length; i++) if (a[i] != null && isFinite(a[i])) r.push({ time: times[i], value: a[i] }); return r; }
    var ohlc = [], vol = [], i;
    for (i = 0; i < times.length; i++) {
      ohlc.push({ time: times[i], open: opens[i], high: highs[i], low: lows[i], close: closes[i] });
      vol.push({ time: times[i], value: (volumes && volumes[i]) ? volumes[i] : 0, color: closes[i] >= opens[i] ? 'rgba(38,166,154,0.5)' : 'rgba(239,83,80,0.5)' });
    }
    return { times: times, closes: closes, highs: highs, lows: lows, ohlc: ohlc, vol: vol,
      ma20: align(smaSeries(closes, 20)), ma50: align(smaSeries(closes, 50)), rsi: align(rsiSeries(closes, 14)) };
  }
  function demoData() {
    var n = 252, opens = [], highs = [], lows = [], closes = [], vols = [];
    var seed = 20240117, rnd = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    var price = 32, i;
    for (i = 0; i < n; i++) {
      var ret = 0.0004 + (rnd() - 0.5) * 0.032, open = price, close = Math.max(1, open * (1 + ret));
      opens.push(+open.toFixed(2)); closes.push(+close.toFixed(2));
      highs.push(+(Math.max(open, close) * (1 + rnd() * 0.012)).toFixed(2));
      lows.push(+(Math.min(open, close) * (1 - rnd() * 0.012)).toFixed(2));
      vols.push(Math.round(2e6 + rnd() * 8e6)); price = close;
    }
    return toSeries(daysAgoDates(n), opens, highs, lows, closes, vols);
  }
  function parsePaste(text) {
    var nums = (text.match(/-?\d+(\.\d+)?/g) || []).map(Number).filter(function (x) { return isFinite(x) && x > 0; });
    if (nums.length < 5) return null;
    var opens = [], highs = [], lows = [], vols = [], i;
    for (i = 0; i < nums.length; i++) {
      var open = i === 0 ? nums[0] : nums[i - 1];
      opens.push(open); highs.push(Math.max(open, nums[i]) * 1.004); lows.push(Math.min(open, nums[i]) * 0.996); vols.push(0);
    }
    return toSeries(daysAgoDates(nums.length), opens, highs, lows, nums, vols);
  }

  /* ── ดึงราคา Yahoo (.BK) หลายเส้นทาง best-effort ─────────────── */
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
    var base = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '.BK?range=1y&interval=1d';
    var enc = encodeURIComponent(base);
    var tries = [
      { name: 'allorigins', url: 'https://api.allorigins.win/raw?url=' + enc },
      { name: 'codetabs', url: 'https://api.codetabs.com/v1/proxy/?quest=' + enc },
      { name: 'corseu', url: 'https://cors.eu.org/' + base },
      { name: 'corsworkers', url: 'https://test.cors.workers.dev/?' + base },
      { name: 'corslol', url: 'https://api.cors.lol/?url=' + enc },
      { name: 'corsfix', url: 'https://proxy.corsfix.com/?' + base },
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

  /* ── cache ราคาต่อหุ้น (localStorage) — กันดึงพลาดแล้วหน้าว่าง/ error ── */
  function cacheKey(sym) { return 'tanot:invest:cache:' + sym; }
  function saveCache(sym, s) {
    try {
      var o = { ts: Date.now(), t: s.times, o: s.ohlc.map(function (b) { return b.open; }), h: s.highs, l: s.lows, c: s.closes, v: s.vol.map(function (b) { return b.value; }) };
      localStorage.setItem(cacheKey(sym), JSON.stringify(o));
    } catch (e) {}
  }
  function loadCache(sym) {
    try {
      var o = JSON.parse(localStorage.getItem(cacheKey(sym)));
      if (!o || !o.c || o.c.length < 5) return null;
      var s = toSeries(o.t, o.o, o.h, o.l, o.c, o.v); s.cachedAt = o.ts; return s;
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
    if (mins < 1) return t('justNow');
    if (mins < 60) return t('minsAgo', { n: mins });
    var hrs = Math.round(mins / 60);
    if (hrs < 24) return t('hrsAgo', { n: hrs });
    return t('daysAgo', { n: Math.round(hrs / 24) });
  }

  /* ══════ กราฟ lightweight-charts ══════ */
  var LWC = null, chart = null, candle = null, volS = null, ma20S = null, ma50S = null, rsiChart = null, rsiS = null;
  var fullData = null, curTF = 63, tg = { ma20: true, ma50: true, vol: true, rsi: false }, syncing = false, themeObs = null;

  function themeColors() {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return dark ? { bg: '#1B2030', text: '#C2CBDD', grid: '#2A3040', border: '#2A3040' }
                : { bg: '#FFFFFF', text: '#4A5568', grid: '#EEF1F7', border: '#E4E9F2' };
  }
  function chartWidth(el) { return Math.max(240, (el && (el.clientWidth || el.offsetWidth)) || (el && el.parentElement && el.parentElement.clientWidth) || 320); }
  function baseOpts(w, h) {
    var c = themeColors();
    return {
      width: w, height: h,
      localization: { locale: 'en-US' },
      layout: { background: { color: c.bg }, textColor: c.text, fontFamily: "'Prompt',system-ui,sans-serif" },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      rightPriceScale: { borderColor: c.border },
      timeScale: { borderColor: c.border, rightOffset: 3, fixLeftEdge: true },
      crosshair: { mode: (LWC && LWC.CrosshairMode) ? LWC.CrosshairMode.Normal : 1 },
      handleScroll: true, handleScale: true
    };
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
    rsiS = rsiChart.addLineSeries({ color: '#6C63D9', lineWidth: 2, priceLineVisible: false });
    try {
      rsiS.createPriceLine({ price: 70, color: '#ef5350', lineStyle: 2, lineWidth: 1, axisLabelVisible: true, title: '70' });
      rsiS.createPriceLine({ price: 30, color: '#26a69a', lineStyle: 2, lineWidth: 1, axisLabelVisible: true, title: '30' });
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
    volS.setData(fullData.vol.slice(s));
    ma20S.setData(fullData.ma20.filter(function (p) { return p.time >= cut; }));
    ma50S.setData(fullData.ma50.filter(function (p) { return p.time >= cut; }));
    if (rsiChart && rsiS) rsiS.setData(fullData.rsi.filter(function (p) { return p.time >= cut; }));
    chart.timeScale().fitContent();
    if (rsiChart) rsiChart.timeScale().fitContent();
    updateLegendLast();
    [].forEach.call(document.querySelectorAll('#tfGroup .tf'), function (b) { b.classList.toggle('on', +b.getAttribute('data-tf') === n); });
  }
  function setupThemeObserver() {
    if (themeObs) return;
    themeObs = new MutationObserver(function () {
      var c = themeColors();
      [chart, rsiChart].forEach(function (ch) {
        if (!ch) return;
        ch.applyOptions({ layout: { background: { color: c.bg }, textColor: c.text }, grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } }, rightPriceScale: { borderColor: c.border }, timeScale: { borderColor: c.border } });
      });
    });
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
  function buildChart(data) {
    if (!window.LightweightCharts) { return false; }
    LWC = window.LightweightCharts; fullData = data;
    if (chart) { try { chart.remove(); } catch (e) {} chart = null; }
    if (rsiChart) { try { rsiChart.remove(); } catch (e) {} rsiChart = null; rsiS = null; }
    /* โชว์การ์ดก่อนสร้างกราฟ — ถ้าสร้างตอนกล่องยังซ่อน (กว้าง 0) iOS Safari มักไม่วาด */
    $('chartCard').style.display = 'block';
    var el = $('lwChart'); el.innerHTML = '';
    chart = LWC.createChart(el, baseOpts(chartWidth(el), 300));
    candle = chart.addCandlestickSeries({ upColor: '#26a69a', downColor: '#ef5350', borderVisible: false, wickUpColor: '#26a69a', wickDownColor: '#ef5350' });
    volS = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'vol' });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    ma20S = chart.addLineSeries({ color: '#F5A524', lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    ma50S = chart.addLineSeries({ color: '#3B9BEA', lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
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

  /* ── ป้อนชุดข้อมูล → วิเคราะห์ + วาดกราฟ ─────────────────────── */
  var lastSource = { kind: 'real' };
  function setSourceBadge(src, days) {
    var el = $('chartSource'); if (!el) return;
    if (src) lastSource = src; else src = lastSource;
    if (src.kind === 'demo') { el.className = 'src-badge demo'; el.textContent = t('demoBadge'); }
    else if (src.kind === 'paste') { el.className = 'src-badge paste'; el.textContent = t('pastedBadge', { days: days }); }
    else { el.className = 'src-badge real'; el.textContent = t('realBadge', { label: src.label || t('realBadgeLabel'), status: src.stale ? t('staleLatestPrice', { age: cacheAgeText(src.cachedAt) }) : t('realBadgeLabel'), days: days }); }
  }
  function useSeries(s, msg, cls, src) {
    lastSeries = s;
    var c = s.closes;
    $('price').value = c[c.length - 1].toFixed(2);
    $('hi').value = Math.max.apply(null, c).toFixed(2);
    $('lo').value = Math.min.apply(null, c).toFixed(2);
    if (msg) setStatus(msg, cls);
    setSourceBadge(src, c.length);
    showAnalysis(analyzeSeries(s));
    if (!buildChart(s)) setStatus(t('chartLibFail'), 'err');
  }

  /* หัวหุ้น (สไตล์ใหม่) — อัปเดตชื่อ/ราคา/ชิปสัญญาณ + กล่องเหตุผลที่ขยายได้ */
  function updateStockHead(sym) {
    $('shead').style.display = 'flex';
    $('stkSym').textContent = sym;
    var c = getCompanyInfo(sym);
    $('stkName').textContent = c ? c.name : sym;
    $('stkSector').textContent = c ? c.sector : t('defaultSector');
  }
  function showAnalysis(a) {
    lastAnalysis = a;
    var bulbColors = { green: 'var(--ok)', yellow: 'var(--amber)', red: 'var(--err)' };
    $('verdictDot').style.background = bulbColors[a.light] || '#B8C0D4';
    $('verdictTxt').textContent = a.verdict;
    $('whyTitle').textContent = a.verdict;
    var lines = [a.why];
    if (a.pros && a.pros.length > 1) lines = lines.concat(a.pros.slice(1));
    if (a.cons && a.cons.length) lines = lines.concat(a.cons);
    $('whyList').innerHTML = lines.map(function (x) { return '<li>' + x + '</li>'; }).join('');
    $('px').textContent = fmt(a.price);
    var prevClose = (lastSeries && lastSeries.closes.length > 1) ? lastSeries.closes[lastSeries.closes.length - 2] : NaN;
    if (isFinite(prevClose) && prevClose) {
      var diff = a.price - prevClose, pct = diff / prevClose * 100;
      $('chg').textContent = (diff >= 0 ? '+' : '−') + fmt(Math.abs(diff)) + ' (' + (diff >= 0 ? '+' : '−') + fmt(Math.abs(pct)) + '%)';
      $('chg').className = 'delta num ' + (diff >= 0 ? 'up' : 'dn');
    } else { $('chg').textContent = '—'; $('chg').className = 'delta num'; }

    if (a.det && !a.simple && isFinite(a.det.rsi)) {
      var d = a.det, rows = [
        [t('detEma20'), fmt(d.ema20)], [t('detEma50'), fmt(d.ema50)],
        [t('detRsi'), fmt(d.rsi, 1)], [t('detMacd'), fmt(d.macdHist, 3)],
        [t('detBbUp'), fmt(d.bbUpper)], [t('detBbLo'), fmt(d.bbLower)],
        [t('detAtr'), fmt(d.atr)], [t('detSupport'), fmt(d.support)], [t('detResistance'), fmt(d.resistance)],
        [t('detAdx'), isFinite(d.adx) ? fmt(d.adx, 0) + (d.adx >= 20 ? t('detAdxStrong') : t('detAdxWeak')) : '—'],
        [t('detSar'), d.psar ? fmt(d.psar.sar) + (d.psar.up ? t('detSarUp') : t('detSarDn')) : '—']
      ], html = '';
      rows.forEach(function (r) { html += '<div class="k">' + r[0] + '</div><div class="v">' + r[1] + '</div>'; });
      $('detKv').innerHTML = html;
      $('detailsBox').style.display = 'block';
    } else { $('detailsBox').style.display = 'none'; }

    if (!$('entry').value) $('entry').value = a.price.toFixed(2);
    if (!$('stop').value && isFinite(a.suggestStop)) $('stop').value = a.suggestStop.toFixed(2);

    /* การ์ด "สรุปหุ้นด้วย AI" — โชว์เมื่อมีไฟจราจรจริง (ไม่ใช่ light: 'gray' ที่ยังไม่มีข้อมูลราคาเลย)
       รีเซ็ตผลสรุปเก่าทิ้งทุกครั้งที่เปลี่ยนหุ้น/โหลดข้อมูลใหม่ กันโชว์สรุปของหุ้นตัวก่อนหน้าค้างอยู่ */
    if (a.light && a.light !== 'gray') {
      $('aiSumCard').style.display = 'block';
      $('aiSumOut').style.display = 'none'; $('aiSumOut').textContent = '';
      setAiSumStatus('', '');
    } else {
      $('aiSumCard').style.display = 'none';
    }
  }

  function setStatus(msg, cls) { var el = $('fetchStatus'); el.textContent = msg; el.className = 'status' + (cls ? ' ' + cls : ''); }

  function doAnalyze() {
    if (lastSeries) { useSeries(lastSeries); return; }
    var price = num($('price').value), hi = num($('hi').value), lo = num($('lo').value);
    if (!isFinite(price)) { setStatus(t('enterPriceFirst'), 'err'); return; }
    $('chartCard').style.display = 'none';
    if (isFinite(hi) && isFinite(lo) && hi > lo) showAnalysis(analyzeSimple(price, hi, lo));
    else {
      showAnalysis({ light: 'gray', verdict: t('gapNeedInfo'), why: t('gapNeedInfoWhy'), pros: [], cons: [], price: price, suggestStop: price * 0.95, resistance: NaN, det: {}, simple: true });
      $('detailsBox').style.display = 'none';
    }
  }
  /* ══════ Live Market Data Gateway ═════════════════════════════════════
     ลำดับความสำคัญ: Tanot Gateway ของตัวเอง (ถ้าตั้งค่าไว้) -> Twelve Data (ใส่ API key เอง) -> Yahoo/ย้อนหลัง (เดิม)
     ไม่มี backend ของเว็บนี้ — Gateway ต้องเป็นเซิร์ฟเวอร์ของผู้ใช้เอง, Twelve Data key เก็บเฉพาะเครื่อง ไม่ commit ขึ้น GitHub */
  var LIVE_CFG_KEY = 'tanot:market:live-config:v1';
  var liveTimer = null, liveBusy = false, liveLast = null, symInputDebounce = null;
  function liveCfg() {
    var d = { provider: 'gateway', gateway: '', apiKey: '', interval: 5 };
    try { var x = JSON.parse(localStorage.getItem(LIVE_CFG_KEY) || '{}'); Object.keys(d).forEach(function (k) { if (x[k] != null) d[k] = x[k]; }); } catch (e) {}
    return d;
  }
  function saveLiveCfg(c) { try { localStorage.setItem(LIVE_CFG_KEY, JSON.stringify(c)); } catch (e) {} }
  function setLiveUI(kind, label, meta) {
    var dot = $('marketLiveDot'), title = $('marketLiveLabel'), m = $('marketLiveMeta');
    if (!dot || !title || !m) return;
    dot.className = 'market-live-dot ' + (kind === 'live' ? 'live' : kind === 'delay' ? 'delay' : '');
    title.textContent = t('liveModePrefix') + label; m.textContent = meta || '';
  }
  function gatewayBase(c) { return (c.gateway || '').replace(/\/$/, ''); }
  function fetchJson(url, opts) {
    return fetch(url, Object.assign({ headers: { 'Accept': 'application/json' } }, opts || {})).then(function (r) {
      return r.text().then(function (txt) {
        var j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) {}
        if (!r.ok) throw new Error((j && (j.message || j.error)) || ('HTTP ' + r.status));
        return j || {};
      });
    });
  }
  function normalizeLiveQuote(j, sym) {
    var q = j && (j.quote || j.data || j.result || j); q = q && (q.data || q.quote || q);
    var price = Number(q && (q.price != null ? q.price : (q.close != null ? q.close : q.last)));
    if (!isFinite(price)) throw new Error('quote price missing');
    var prev = Number(q.previous_close != null ? q.previous_close : (q.prev_close != null ? q.prev_close : q.previousClose));
    var ch = Number(q.change), pct = Number(q.percent_change != null ? q.percent_change : q.percentChange);
    if (!isFinite(ch) && isFinite(prev)) ch = price - prev; if (!isFinite(pct) && isFinite(prev) && prev) pct = ch / prev * 100;
    return { sym: sym, price: price, previous: prev, change: ch, pct: pct, volume: Number(q.volume), timestamp: Number(q.timestamp || q.last_quote_at || Date.now() / 1000) * 1000, marketOpen: q.is_market_open !== false, source: q.source || 'gateway' };
  }
  function fetchGatewayQuote(sym, c) {
    var base = gatewayBase(c); if (!base) return Promise.reject(new Error('gateway not configured'));
    var u = base + '/quote?symbol=' + encodeURIComponent(sym);
    return fetchJson(u).then(function (j) { var q = normalizeLiveQuote(j, sym); q.source = 'Tanot Gateway'; return q; });
  }
  function fetchTwelveQuote(sym, c) {
    if (!c.apiKey) return Promise.reject(new Error('Twelve Data API key missing'));
    var u = 'https://api.twelvedata.com/quote?symbol=' + encodeURIComponent(sym) + '&exchange=SET&apikey=' + encodeURIComponent(c.apiKey);
    return fetchJson(u).then(function (j) { if (j && j.status === 'error') throw new Error(j.message || 'Twelve Data error'); var q = normalizeLiveQuote(j, sym); q.source = 'Twelve Data'; return q; });
  }
  function applyLiveQuote(q) {
    liveLast = q;
    var p = $('price'); if (p) { p.value = Number(q.price).toFixed(2); p.dispatchEvent(new Event('input', { bubbles: true })); }
    var e = $('entry'); if (e && !e.value) e.value = Number(q.price).toFixed(2);
    var ch = isFinite(q.change) ? (q.change >= 0 ? '+' : '−') + Number(Math.abs(q.change)).toFixed(2) : '—';
    var pct = isFinite(q.pct) ? ' (' + (q.pct >= 0 ? '+' : '') + Number(q.pct).toFixed(2) + '%)' : '';
    var tm = q.timestamp ? new Date(q.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
    setLiveUI('live', t('liveReal'), q.source + ' · ' + ch + pct + ' · ' + t('updatedAt') + tm);
    setStatus(t('latestPriceMsg', { price: Number(q.price).toFixed(2), source: q.source, time: tm }), 'ok');
  }
  function refreshLiveQuote() {
    if (liveBusy) return; var c = liveCfg(), sym = ($('sym') && $('sym').value || '').trim().toUpperCase().replace(/\.BK$/, '');
    if (!sym || c.provider === 'yahoo') { setLiveUI('', t('liveHistorical'), t('liveYahooMeta')); return; }
    liveBusy = true;
    var pr = c.provider === 'twelvedata' ? fetchTwelveQuote(sym, c) : fetchGatewayQuote(sym, c);
    pr.then(applyLiveQuote).catch(function (err) {
      var reason = err && err.message;
      setLiveUI('delay', t('liveFallback'), reason ? (t('liveNoConn') + ' — ' + reason) : t('liveNoConn'));
    }).finally(function () { liveBusy = false; });
  }
  function stopLive() { if (liveTimer) { clearInterval(liveTimer); liveTimer = null; } }
  function startLive() { stopLive(); var c = liveCfg(); if (c.provider === 'yahoo') return; liveTimer = setInterval(refreshLiveQuote, Math.max(5, Number(c.interval) || 5) * 1000); refreshLiveQuote(); }
  function initLiveControls() {
    var c = liveCfg(), p = $('marketProvider'), g = $('marketGateway'), k = $('marketApiKey'), iv = $('marketInterval');
    if (!p) return; p.value = c.provider; g.value = c.gateway || ''; k.value = ''; iv.value = String(c.interval || 5);
    $('marketSettings').addEventListener('click', function () { var x = $('marketSettingsPanel'); x.hidden = !x.hidden; });
    $('marketSave').addEventListener('click', function () { var next = { provider: p.value, gateway: g.value.trim(), apiKey: k.value.trim() || c.apiKey, interval: Number(iv.value) || 5 }; saveLiveCfg(next); c = next; startLive(); setStatus(t('settingsSaved'), 'ok'); });
    $('marketClear').addEventListener('click', function () { c.apiKey = ''; saveLiveCfg(c); k.value = ''; setStatus(t('apiKeyCleared'), 'ok'); });
    $('marketRefresh').addEventListener('click', refreshLiveQuote);
    $('sym').addEventListener('input', function () {
      stopLive();
      clearTimeout(symInputDebounce);
      symInputDebounce = setTimeout(function () { var x = liveCfg(); if (x.provider !== 'yahoo') startLive(); }, 700);
    });
    window.addEventListener('beforeunload', stopLive);
    startLive();
  }
  function doFetch() {
    var sym = ($('sym').value || '').trim().toUpperCase().replace(/\.BK$/, '');
    if (!sym) { setStatus(t('typeSymFirst'), 'err'); return; }
    setStatus(t('fetchingData', { sym: sym })); $('fetchBtn').disabled = true;
    updateStockHead(sym);
    var c = liveCfg();
    var livePromise = c.provider === 'twelvedata' ? fetchTwelveQuote(sym, c) : c.provider === 'gateway' ? fetchGatewayQuote(sym, c) : Promise.reject(new Error('historical'));
    livePromise.then(function (q) {
      applyLiveQuote(q);
      /* กราฟยังใช้ historical feed เดิม; ราคาการ์ดใช้ quote สดแทน */
      return getSeries(sym).then(function (r) { var s = r.series; useSeries(s, t('liveFromMsg', { sym: sym, source: q.source, days: s.closes.length }), 'ok', { kind: 'real', label: sym }); showStockNews(sym); });
    }).catch(function () {
      return getSeries(sym).then(function (r) {
        var s = r.series;
        if (r.stale) useSeries(s, t('staleDataMsg', { age: cacheAgeText(r.cachedAt), days: s.closes.length }), 'ok', { kind: 'real', label: sym, stale: true, cachedAt: r.cachedAt });
        else useSeries(s, t('histFromMsg', { source: s.source, days: s.closes.length }), 'ok', { kind: 'real', label: sym });
        showStockNews(sym);
      });
    }).catch(function () { setStatus(t('notFoundMsg', { sym: sym }), 'err'); }).finally(function () { $('fetchBtn').disabled = false; });
  }
  /* ข่าวหุ้นตัวที่กำลังดู — ต่อยอด fetchNewsScan()/parseNewsRss() เดิม (เดิมใช้แค่ในโหมด "ควรขาย?" ของพอร์ต) */
  function showStockNews(sym) {
    $('stockNewsCard').style.display = 'block';
    $('stockNewsTitle').textContent = t('stockNewsWithSym', { sym: sym });
    renderNewsBlock($('stockNewsBlock'), sym);
  }
  function doDemo() { $('stockNewsCard').style.display = 'none'; updateStockHead(t('sampleWord')); useSeries(demoData(), t('demoMsg'), 'ok', { kind: 'demo' }); }
  function doPaste() {
    var s = parsePaste($('pasteBox').value || '');
    if (!s) { setStatus(t('pasteAtLeast5'), 'err'); return; }
    $('stockNewsCard').style.display = 'none';
    useSeries(s, t('pastedMsg', { days: s.closes.length }), 'ok', { kind: 'paste' });
  }

  /* ══════ สรุปหุ้นด้วย AI — ใช้ ai-chat-worker.js ตัวเดียวกับวิดเจ็ตแชทลอย (ai-chat-widget.js)
     รันในเครื่องผู้ใช้เอง ไม่ส่งข้อมูลออกไปไหน แนวทาง "guided summarization" เดียวกับปุ่ม "📝 สรุปหน้านี้"
     ของวิดเจ็ตแชท (โครงสร้างหัวข้อตายตัว ช่วยโมเดลเล็ก 0.5B ตอบสม่ำเสมอ/อ่านง่ายขึ้น) ต่างกันตรงที่นี่ไม่ได้
     ป้อน "เนื้อหาหน้าเว็บดิบ" ให้โมเดลอ่านเอง แต่ป้อน "ตัวเลข/สัญญาณที่หน้านี้คำนวณไว้ให้แล้ว" (RSI/MACD/
     แนวรับ-แนวต้าน ฯลฯ จาก analyzeSeries() ด้านบน) ตรงๆ แทน — กันโมเดลเล็กต้องมาคำนวณ/ตีความตัวเลขเอง
     (ซึ่งไม่แม่นยำพอสำหรับเรื่องเงิน) ให้ทำหน้าที่แค่ "เรียบเรียงเป็นภาษาพูด" จากผลที่คำนวณแม่นแล้วเท่านั้น
     (สอดคล้องกับหลักของเว็บนี้ที่ยึดมาตลอด: ห้ามให้ AI เดา/สร้างตัวเลขเอง) ────────────────────────── */
  var AI_SUMMARY_SYSTEM_PROMPT = 'คุณเป็นผู้ช่วยสรุปข้อมูลหุ้นให้นักลงทุนมือใหม่ชาวไทยฟัง จะได้รับตัวเลข/' +
    'สัญญาณทางเทคนิคที่คำนวณไว้ให้แล้วล่วงหน้า (ห้ามคำนวณหรือเดาตัวเลขเพิ่มเองเด็ดขาด ใช้เฉพาะตัวเลขที่ให้มา) ' +
    'และหัวข้อข่าวล่าสุดของหุ้นตัวนี้ถ้ามี หน้าที่ของคุณคือเรียบเรียงเป็นภาษาพูดที่เข้าใจง่าย ไม่ใช่ผู้แนะนำการลงทุน ' +
    'ตอบเป็นภาษาไทยตามโครงสร้างนี้เท่านั้น (ห้ามขึ้นต้นด้วยคำนำ ให้เริ่มที่ "สรุปภาพรวม:" ทันที):\n\n' +
    'สรุปภาพรวม: (1-2 ประโยค อธิบายสถานะราคาปัจจุบันแบบเข้าใจง่ายจากข้อมูลที่ให้)\n' +
    'ปัจจัยหนุน: (ไม่เกิน 3 ข้อ จากข้อมูลที่ให้เท่านั้น ถ้าไม่มีให้บอกว่า "ไม่มีปัจจัยหนุนเด่นชัดตอนนี้")\n' +
    'ปัจจัยเสี่ยง: (ไม่เกิน 3 ข้อ จากข้อมูลที่ให้เท่านั้น ถ้าไม่มีให้บอกว่า "ไม่มีปัจจัยเสี่ยงเด่นชัดตอนนี้")\n' +
    'ข่าวที่เกี่ยวข้อง: (สรุปสั้นๆ จากหัวข้อข่าวที่ให้มาเท่านั้น ถ้าไม่มีข่าวส่งมาให้บอกว่า "ไม่มีข่าวล่าสุดที่ดึงมาได้ตอนนี้")\n\n' +
    'ห้ามให้คำแนะนำซื้อ/ขาย ห้ามทำนายราคาในอนาคต ห้ามเติมตัวเลข บริษัท หรือเหตุการณ์ที่ไม่ได้อยู่ในข้อมูลที่ให้มาเด็ดขาด';
  var AI_SUMMARY_REMINDER = 'ย้ำ: ห้ามให้คำแนะนำซื้อ/ขาย ห้ามทำนายราคาในอนาคต ห้ามเติมตัวเลข/เหตุการณ์ที่ไม่ได้อยู่ในข้อมูลที่ให้มา ' +
    'ตอบตามโครงสร้าง 4 หัวข้อที่กำหนดเท่านั้น เริ่มที่ "สรุปภาพรวม:" ทันที ห้ามขึ้นต้นด้วยคำนำ';
  var AI_SUMMARY_SYSTEM_PROMPT_EN = 'You are an assistant who summarizes stock data for a novice retail investor. You will be given ' +
    'pre-computed numbers/technical signals (never calculate or guess extra numbers yourself — use only the numbers given) ' +
    "and the stock's latest news headlines if any. Your job is to phrase this as plain, easy-to-understand language, not as an investment advisor. " +
    'Reply in English using ONLY this structure (do not start with any preamble — start directly with "Overview:"):\n\n' +
    'Overview: (1-2 sentences explaining the current price status in plain terms, from the data given)\n' +
    'Tailwinds: (up to 3 bullet points, only from the data given — if none, say "No clear tailwinds right now")\n' +
    'Risks: (up to 3 bullet points, only from the data given — if none, say "No clear risks right now")\n' +
    'Related news: (a short summary from the headlines given only — if no news was provided, say "No recent news could be fetched right now")\n\n' +
    'Never give buy/sell advice. Never predict future prices. Never add numbers, companies, or events not present in the data given.';
  var AI_SUMMARY_REMINDER_EN = 'Reminder: never give buy/sell advice, never predict future prices, never add numbers/events not present in the data given. ' +
    'Reply using only the 4-section structure above, starting directly with "Overview:" — no preamble.';

  function isIOS() {
    if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) return true;
    return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  }
  function friendlyChatError(rawMessage) {
    var msg = rawMessage || '';
    if (/bad_alloc|Can't create a session|out of memory/i.test(msg)) {
      return t('memErrorMsg');
    }
    if (/QuotaExceededError|quota.{0,20}exceeded|not enough.{0,10}(space|storage)|no space left/i.test(msg)) {
      return t('diskErrorMsg');
    }
    return msg;
  }

  var aiSumChatWorker = null, aiSumJobSeq = 0, aiSumBusy = false;
  function getAiSumWorker() { if (!aiSumChatWorker) aiSumChatWorker = new Worker('./ai-chat-worker.js', { type: 'module' }); return aiSumChatWorker; }
  function setAiSumStatus(text, cls) { var el = $('aiSumStatus'); if (!el) return; el.textContent = text || ''; el.className = 'status' + (cls ? ' ' + cls : ''); }

  function buildStockContext() {
    var a = lastAnalysis; if (!a) return null;
    var sym = (lastSource && lastSource.label) ? lastSource.label : (($('sym').value || '').trim().toUpperCase() || t('thisStock'));
    var lines = [t('ctxStock', { v: sym }), t('ctxLatestPrice', { v: fmt(a.price) }), t('ctxVerdict', { v: a.verdict, why: a.why })];
    if (a.pros && a.pros.length) lines.push(t('ctxPros', { v: a.pros.join(', ') }));
    if (a.cons && a.cons.length) lines.push(t('ctxCons', { v: a.cons.join(', ') }));
    var d = a.det || {};
    if (isFinite(d.rsi)) lines.push(t('ctxRsi', { v: fmt(d.rsi, 1) }) + (d.rsi > 70 ? t('ctxRsiHigh') : d.rsi < 38 ? t('ctxRsiLow') : t('ctxRsiMid')));
    if (isFinite(d.macdHist)) lines.push(t('ctxMacd', { v: fmt(d.macdHist, 3) }) + (d.macdHist >= 0 ? t('ctxMacdPos') : t('ctxMacdNeg')));
    if (isFinite(d.ema20) && isFinite(d.ema50)) lines.push(t('ctxEma', { e20: fmt(d.ema20), e50: fmt(d.ema50) }) + (a.uptrend ? t('ctxEmaUp') : t('ctxEmaDn')));
    if (isFinite(d.support)) lines.push(t('ctxSupport', { v: fmt(d.support) }));
    if (isFinite(d.resistance)) lines.push(t('ctxResistance', { v: fmt(d.resistance) }));
    if (isFinite(d.adx)) lines.push(t('ctxAdx', { v: fmt(d.adx, 0) }) + (d.adx >= 20 ? t('ctxAdxStrong') : t('ctxAdxWeak')));
    if (lastNewsItems && lastNewsItems.length) {
      lines.push(t('ctxNewsWithCount', { n: lastNewsItems.length, v: lastNewsItems.slice(0, 5).map(function (n) { return n.title; }).join(' / ') }));
    } else {
      lines.push(t('ctxNoNews'));
    }
    return lines.join('\n');
  }

  function doAiSummary() {
    if (aiSumBusy) return;
    if (isIOS()) {
      setAiSumStatus(t('iosNotSupported'), 'err');
      return;
    }
    var ctx = buildStockContext();
    if (!ctx) { setAiSumStatus(t('needStockData'), 'err'); return; }

    aiSumBusy = true;
    $('aiSumBtn').disabled = true;
    $('aiSumOut').style.display = 'none'; $('aiSumOut').textContent = '';
    setAiSumStatus(t('summarizing'), '');

    var isEn = getUILang() === 'en';
    var payloadMessages = [
      { role: 'system', content: isEn ? AI_SUMMARY_SYSTEM_PROMPT_EN : AI_SUMMARY_SYSTEM_PROMPT },
      { role: 'user', content: ctx },
      { role: 'system', content: isEn ? AI_SUMMARY_REMINDER_EN : AI_SUMMARY_REMINDER }
    ];
    var jobId = ++aiSumJobSeq, replyText = '';
    var w = getAiSumWorker();

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
        $('aiSumOut').textContent = replyText;
      } else if (msg.type === 'done') {
        cleanup();
        if (!replyText) setAiSumStatus(t('summarizeFail'), 'err');
        aiSumBusy = false; $('aiSumBtn').disabled = false;
      } else if (msg.type === 'error') {
        cleanup();
        $('aiSumOut').style.display = 'none'; $('aiSumOut').textContent = '';
        setAiSumStatus(t('summarizeFailWith', { msg: friendlyChatError(msg.message) }), 'err');
        aiSumBusy = false; $('aiSumBtn').disabled = false;
      }
    }
    function onErr(e) {
      cleanup();
      $('aiSumOut').style.display = 'none'; $('aiSumOut').textContent = '';
      setAiSumStatus(t('summarizeFailWith', { msg: friendlyChatError(e.message || t('unknownReason')) }), 'err');
      aiSumBusy = false; $('aiSumBtn').disabled = false;
    }
    function cleanup() { w.removeEventListener('message', onMsg); w.removeEventListener('error', onErr); }
    w.addEventListener('message', onMsg);
    w.addEventListener('error', onErr);
    w.postMessage({ type: 'chat', jobId: jobId, messages: payloadMessages });
  }

  /* ── ควรขาย? สำหรับหุ้นที่ถือ ─────────────────────────────── */
  function sellVerdict(a) {
    var det = a.det || {}, ps = det.psar;
    var cls, headline;
    if (ps && !ps.up) { cls = 'no'; headline = t('sellSarDn'); }
    else if (!a.uptrend || (isFinite(det.ema20) && a.price < det.ema20)) { cls = 'no'; headline = t('sellBelowTrend'); }
    else if (isFinite(a.rsi) && a.rsi > 70) { cls = 'warn'; headline = t('sellHotRsi'); }
    else if (isFinite(a.resistance) && a.price >= a.resistance * 0.98) { cls = 'warn'; headline = t('sellNearResist'); }
    else { cls = 'go'; headline = t('sellHold'); }

    var levels = [
      { key: 'sar', type: 'stop', label: t('sarLabel'), price: ps ? ps.sar : NaN,
        reason: !ps ? t('sarNoData') : (ps.up ? t('sarUpReason', { price: fmt(ps.sar) }) : t('sarDnReason')) },
      { key: 'stop', type: 'stop', label: t('stopRiskLabel'), price: a.suggestStop,
        reason: !isFinite(a.suggestStop) ? t('noData') : t('stopRiskReason', { atr: isFinite(det.atr) ? t('atrSuffix', { atr: fmt(det.atr) }) : '' }) },
      { key: 'ema20', type: 'warn', label: t('ema20Label'), price: det.ema20,
        reason: !isFinite(det.ema20) ? t('noData') : t('ema20Reason') },
      { key: 'resistance', type: 'tp', label: t('resistLabel'), price: isFinite(det.resistance) ? det.resistance : a.resistance,
        reason: !isFinite(isFinite(det.resistance) ? det.resistance : a.resistance) ? t('noData') : t('resistReason') }
    ];
    return { cls: cls, headline: headline, levels: levels };
  }
  function sellLevelsHtml(levels) {
    var html = '<ul class="sell-levels">';
    levels.forEach(function (lv) {
      html += '<li><div class="row ' + lv.type + '"><span>' + lv.label + '</span><span class="price">' +
        (isFinite(lv.price) ? fmt(lv.price) : '—') + '</span></div><div class="reason">' + lv.reason + '</div></li>';
    });
    html += '</ul>';
    return html;
  }

  /* ══════ ข้อมูลบริษัท/กลุ่มธุรกิจ (ข้อมูลอ้างอิงสาธารณะ) ══════ */
  var COMPANY_INFO = {
    ADVANC: { name: 'แอดวานซ์ อินโฟร์ เซอร์วิส (เอไอเอส)', sector: 'ICT/สื่อสาร', business: 'ผู้ให้บริการเครือข่ายโทรศัพท์เคลื่อนที่รายใหญ่ที่สุดของไทย รวมถึงบรอดแบนด์และดิจิทัลเซอร์วิส' },
    AOT: { name: 'ท่าอากาศยานไทย', sector: 'ขนส่ง/โครงสร้างพื้นฐาน', business: 'ผู้บริหารสนามบินหลักของประเทศ (สุวรรณภูมิ ดอนเมือง เชียงใหม่ ภูเก็ต หาดใหญ่) รายได้หลักจากค่าธรรมเนียมสนามบินและสัมปทานเชิงพาณิชย์' },
    AWC: { name: 'แอสเสท เวิรด์ คอร์ป', sector: 'ท่องเที่ยว/โรงแรม/บริการอาหาร', business: 'กลุ่มอสังหาริมทรัพย์เพื่อการค้าปลีก โรงแรม และพื้นที่สำนักงาน ในเครือทีซีซี' },
    BANPU: { name: 'บ้านปู', sector: 'พลังงาน/ปิโตรเคมี', business: 'ธุรกิจถ่านหินและพลังงานครบวงจร ทั้งในไทยและต่างประเทศ รวมถึงธุรกิจไฟฟ้าและพลังงานสะอาด' },
    BBL: { name: 'ธนาคารกรุงเทพ', sector: 'ธนาคาร', business: 'ธนาคารพาณิชย์ขนาดใหญ่ที่สุดของไทยตามสินทรัพย์ เน้นลูกค้าธุรกิจขนาดใหญ่และองค์กร' },
    BDMS: { name: 'กรุงเทพดุสิตเวชการ', sector: 'สุขภาพ', business: 'เครือโรงพยาบาลเอกชนรายใหญ่ที่สุดของไทย (โรงพยาบาลกรุงเทพ, สมิติเวช, บีเอ็นเอช ฯลฯ)' },
    BEM: { name: 'ทางด่วนและรถไฟฟ้ากรุงเทพ', sector: 'ขนส่ง/โครงสร้างพื้นฐาน', business: 'ผู้บริหารทางพิเศษ (ทางด่วน) และรถไฟฟ้าสายสีน้ำเงิน/สีม่วง' },
    BGRIM: { name: 'บี.กริม เพาเวอร์', sector: 'พลังงาน/ปิโตรเคมี', business: 'ผู้ผลิตไฟฟ้าเอกชนรายใหญ่ เน้นโรงไฟฟ้าพลังงานร่วม (โคเจนเนอเรชัน) และพลังงานหมุนเวียน' },
    BH: { name: 'โรงพยาบาลบำรุงราษฎร์', sector: 'สุขภาพ', business: 'โรงพยาบาลเอกชนพรีเมียม เน้นลูกค้าต่างชาติและการแพทย์เฉพาะทาง' },
    BTS: { name: 'บีทีเอส กรุ๊ป โฮลดิ้งส์', sector: 'ขนส่ง/โครงสร้างพื้นฐาน', business: 'ผู้บริหารรถไฟฟ้าบีทีเอส รวมถึงธุรกิจสื่อโฆษณาและอสังหาริมทรัพย์' },
    CBG: { name: 'คาราบาวกรุ๊ป', sector: 'อาหารและเครื่องดื่ม', business: 'ผู้ผลิตเครื่องดื่มชูกำลังคาราบาวแดง และเครื่องดื่ม/สินค้าอุปโภคบริโภคอื่นๆ ทั้งในและต่างประเทศ' },
    CENTEL: { name: 'โรงแรมเซ็นทรัลพลาซา', sector: 'ท่องเที่ยว/โรงแรม/บริการอาหาร', business: 'ธุรกิจโรงแรม (เซ็นทารา) และร้านอาหาร (เคเอฟซี มิสเตอร์โดนัท ฯลฯ) ในเครือเซ็นทรัล' },
    COM7: { name: 'คอมเซเว่น', sector: 'พาณิชย์/ค้าปลีก', business: 'ผู้จำหน่ายสินค้าไอที/มือถือรายใหญ่ (บานาน่า สตูดิโอ 7 ฯลฯ) ตัวแทนจำหน่าย Apple ในไทย' },
    CPALL: { name: 'ซีพี ออลล์', sector: 'พาณิชย์/ค้าปลีก', business: 'ผู้บริหารร้านสะดวกซื้อ 7-Eleven ในไทย รายใหญ่ที่สุดของประเทศ รวมถึงธุรกิจค้าส่ง (แม็คโคร)' },
    CPF: { name: 'เจริญโภคภัณฑ์อาหาร', sector: 'อาหารและเครื่องดื่ม', business: 'ธุรกิจเกษตรอุตสาหกรรมและอาหารครบวงจร (สัตว์บก/สัตว์น้ำ อาหารสัตว์ อาหารแปรรูป) รายใหญ่ระดับโลก' },
    CPN: { name: 'เซ็นทรัลพัฒนา', sector: 'พัฒนาอสังหาริมทรัพย์', business: 'ผู้พัฒนาและบริหารศูนย์การค้า (เซ็นทรัล) รายใหญ่ที่สุดของไทย รวมถึงที่อยู่อาศัยและอาคารสำนักงาน' },
    CRC: { name: 'เซ็นทรัล รีเทล คอร์ปอเรชั่น', sector: 'พาณิชย์/ค้าปลีก', business: 'ธุรกิจค้าปลีกในเครือเซ็นทรัล (ห้างสรรพสินค้า ซูเปอร์มาร์เก็ต ฯลฯ) ทั้งในไทยและต่างประเทศ' },
    DELTA: { name: 'เดลต้า อีเลคโทรนิคส์', sector: 'ชิ้นส่วนอิเล็กทรอนิกส์', business: 'ผู้ผลิตชิ้นส่วนอิเล็กทรอนิกส์ เน้นอุปกรณ์จ่ายไฟและระบบจัดการพลังงานให้อุตสาหกรรมทั่วโลก' },
    EA: { name: 'พลังงานบริสุทธิ์', sector: 'พลังงาน/ปิโตรเคมี', business: 'ธุรกิจพลังงานหมุนเวียน (โซลาร์/ลม) และยานยนต์ไฟฟ้า/แบตเตอรี่' },
    EGCO: { name: 'ผลิตไฟฟ้า', sector: 'พลังงาน/ปิโตรเคมี', business: 'ผู้ผลิตไฟฟ้าเอกชนรายใหญ่ ทั้งในไทยและต่างประเทศ' },
    GLOBAL: { name: 'สยามโกลบอลเฮ้าส์', sector: 'พาณิชย์/ค้าปลีก', business: 'ธุรกิจค้าปลีกวัสดุก่อสร้างและสินค้าตกแต่งบ้านแบบครบวงจร' },
    GPSC: { name: 'โกลบอล เพาเวอร์ ซินเนอร์ยี่', sector: 'พลังงาน/ปิโตรเคมี', business: 'บริษัทแกนนำธุรกิจไฟฟ้าในกลุ่ม ปตท. ผลิตไฟฟ้าและไอน้ำให้ลูกค้าอุตสาหกรรม' },
    GULF: { name: 'กัลฟ์ เอ็นเนอร์จี ดีเวลลอปเมนท์', sector: 'พลังงาน/ปิโตรเคมี', business: 'ผู้ผลิตไฟฟ้าเอกชนรายใหญ่ ขยายสู่ธุรกิจโครงสร้างพื้นฐานและดิจิทัล' },
    HMPRO: { name: 'โฮมโปรดักส์ เซ็นเตอร์', sector: 'พาณิชย์/ค้าปลีก', business: 'ธุรกิจค้าปลีกสินค้าตกแต่ง/ซ่อมแซมบ้าน (โฮมโปร เมกาโฮม)' },
    INTUCH: { name: 'อินทัช โฮลดิ้งส์', sector: 'ICT/สื่อสาร', business: 'บริษัทโฮลดิ้งที่ถือหุ้นใหญ่ใน ADVANC (เอไอเอส) รายได้หลักมาจากเงินปันผล' },
    IVL: { name: 'อินโดรามา เวนเจอร์ส', sector: 'พลังงาน/ปิโตรเคมี', business: 'ผู้ผลิตปิโตรเคมีและเส้นใย (PET/โพลีเอสเตอร์) รายใหญ่ระดับโลก' },
    KBANK: { name: 'ธนาคารกสิกรไทย', sector: 'ธนาคาร', business: 'ธนาคารพาณิชย์รายใหญ่ของไทย ให้บริการสินเชื่อ เงินฝาก และธุรกรรมทางการเงินครบวงจร' },
    KCE: { name: 'เคซีอี อีเลคโทรนิคส์', sector: 'ชิ้นส่วนอิเล็กทรอนิกส์', business: 'ผู้ผลิตแผ่นพิมพ์วงจรอิเล็กทรอนิกส์ (PCB) เน้นส่งออกชิ้นส่วนยานยนต์/อุตสาหกรรม' },
    KKP: { name: 'ธนาคารเกียรตินาคินภัทร', sector: 'ธนาคาร', business: 'ธนาคารพาณิชย์ขนาดกลาง เน้นสินเชื่อรถยนต์และธุรกิจวาณิชธนกิจ/บริหารความมั่งคั่ง' },
    KTB: { name: 'ธนาคารกรุงไทย', sector: 'ธนาคาร', business: 'ธนาคารพาณิชย์ที่รัฐถือหุ้นใหญ่ เน้นบริการภาครัฐและประชาชนทั่วไป' },
    KTC: { name: 'บัตรกรุงไทย', sector: 'เงินทุน/สินเชื่อ', business: 'ผู้ให้บริการบัตรเครดิตและสินเชื่อส่วนบุคคลรายใหญ่' },
    LH: { name: 'แลนด์แอนด์เฮ้าส์', sector: 'พัฒนาอสังหาริมทรัพย์', business: 'ผู้พัฒนาอสังหาริมทรัพย์ (บ้านจัดสรร คอนโด) รายใหญ่ของไทย' },
    MINT: { name: 'ไมเนอร์ อินเตอร์เนชั่นแนล', sector: 'ท่องเที่ยว/โรงแรม/บริการอาหาร', business: 'ธุรกิจโรงแรม (NH, Anantara) ร้านอาหาร (เดอะ พิซซ่า คอมปะนี สเวนเซ่นส์) และจัดจำหน่ายสินค้าไลฟ์สไตล์' },
    MTC: { name: 'เมืองไทย แคปปิตอล', sector: 'เงินทุน/สินเชื่อ', business: 'ผู้ให้บริการสินเชื่อจำนำทะเบียนรถและสินเชื่อรายย่อย' },
    OR: { name: 'ปตท. น้ำมันและการค้าปลีก', sector: 'พาณิชย์/ค้าปลีก', business: 'ธุรกิจสถานีบริการน้ำมัน (PTT Station) และค้าปลีกในสถานี (คาเฟ่ อเมซอน)' },
    OSP: { name: 'โอสถสภา', sector: 'อาหารและเครื่องดื่ม', business: 'ผู้ผลิตเครื่องดื่มชูกำลัง (เอ็ม-150) และสินค้าอุปโภคบริโภค' },
    PTT: { name: 'ปตท.', sector: 'พลังงาน/ปิโตรเคมี', business: 'ธุรกิจก๊าซธรรมชาติ น้ำมัน และปิโตรเคมีครบวงจร รัฐเป็นผู้ถือหุ้นใหญ่ ถือเป็นบริษัทพลังงานแห่งชาติของไทย' },
    PTTEP: { name: 'ปตท.สำรวจและผลิตปิโตรเลียม', sector: 'พลังงาน/ปิโตรเคมี', business: 'ธุรกิจสำรวจและผลิตปิโตรเลียม (น้ำมัน/ก๊าซ) ทั้งในและต่างประเทศ' },
    PTTGC: { name: 'พีทีที โกลบอล เคมิคอล', sector: 'พลังงาน/ปิโตรเคมี', business: 'ผู้ผลิตปิโตรเคมีและเคมีภัณฑ์รายใหญ่ในเครือ ปตท.' },
    RATCH: { name: 'ราช กรุ๊ป', sector: 'พลังงาน/ปิโตรเคมี', business: 'ผู้ผลิตไฟฟ้าเอกชน (เดิมชื่อผลิตไฟฟ้าราชบุรี) ทั้งในไทยและต่างประเทศ' },
    SAWAD: { name: 'ศรีสวัสดิ์ คอร์ปอเรชั่น', sector: 'เงินทุน/สินเชื่อ', business: 'ผู้ให้บริการสินเชื่อจำนำทะเบียนรถและสินเชื่อรายย่อยรายใหญ่' },
    SCB: { name: 'ธนาคารไทยพาณิชย์', sector: 'ธนาคาร', business: 'ธนาคารพาณิชย์รายใหญ่ของไทย (ถือผ่าน SCB X) ครบวงจรทั้งรายย่อยและองค์กร' },
    SCC: { name: 'ปูนซิเมนต์ไทย (เอสซีจี)', sector: 'วัสดุก่อสร้าง/บรรจุภัณฑ์', business: 'กลุ่มอุตสาหกรรมวัสดุก่อสร้าง ปูนซีเมนต์ ปิโตรเคมี และบรรจุภัณฑ์รายใหญ่ของไทย' },
    SCGP: { name: 'เอสซีจี แพคเกจจิ้ง', sector: 'วัสดุก่อสร้าง/บรรจุภัณฑ์', business: 'ผู้ผลิตบรรจุภัณฑ์ครบวงจรในเครือเอสซีจี' },
    TISCO: { name: 'ทิสโก้ไฟแนนเชียลกรุ๊ป', sector: 'ธนาคาร', business: 'กลุ่มธุรกิจการเงิน เน้นสินเชื่อรถยนต์และธุรกิจบริหารความมั่งคั่ง' },
    TLI: { name: 'ไทยประกันชีวิต', sector: 'ประกันชีวิต', business: 'บริษัทประกันชีวิตรายใหญ่ของไทย' },
    TOP: { name: 'ไทยออยล์', sector: 'พลังงาน/ปิโตรเคมี', business: 'โรงกลั่นน้ำมันรายใหญ่ของไทยในเครือ ปตท.' },
    TRUE: { name: 'ทรู คอร์ปอเรชั่น', sector: 'ICT/สื่อสาร', business: 'ผู้ให้บริการโทรคมนาคม (มือถือ/อินเทอร์เน็ต) หลังการควบรวมทรู-ดีแทค' },
    TTB: { name: 'ธนาคารทหารไทยธนชาต', sector: 'ธนาคาร', business: 'ธนาคารพาณิชย์ที่เกิดจากการควบรวม TMB และธนชาต' },
    TU: { name: 'ไทยยูเนี่ยน กรุ๊ป', sector: 'อาหารและเครื่องดื่ม', business: 'ผู้ผลิตและส่งออกอาหารทะเลแปรรูป (ปลาทูน่ากระป๋อง ฯลฯ) รายใหญ่ระดับโลก' }
  };
  var SECTOR_FACTORS = {
    'ธนาคาร': ['ผลประกอบการอ่อนไหวกับทิศทางดอกเบี้ยนโยบายและคุณภาพสินเชื่อ (หนี้เสีย/NPL)', 'จับตาการประกาศงบการเงินรายไตรมาสและนโยบายจาก ธปท.'],
    'พลังงาน/ปิโตรเคมี': ['กำไรผันผวนตามราคาน้ำมัน/ก๊าซธรรมชาติในตลาดโลกและค่าการกลั่น/ค่าการตลาด', 'นโยบายพลังงานและการกำกับราคาของภาครัฐมีผลโดยตรงต่อธุรกิจ'],
    'ICT/สื่อสาร': ['การแข่งขันด้านราคา/โปรโมชันในตลาดมือถือ และต้นทุนลงทุนโครงข่าย', 'รายได้ส่วนหนึ่งผูกกับพฤติกรรมผู้บริโภคด้านดิจิทัล/อินเทอร์เน็ต'],
    'พาณิชย์/ค้าปลีก': ['ยอดขายอ่อนไหวกับกำลังซื้อผู้บริโภคและการท่องเที่ยว', 'การแข่งขันจากอีคอมเมิร์ซและต้นทุนสาขา/โลจิสติกส์'],
    'อาหารและเครื่องดื่ม': ['ต้นทุนวัตถุดิบผันผวนตามราคาสินค้าโภคภัณฑ์โลก', 'รายได้ส่วนหนึ่งพึ่งพาตลาดส่งออก อ่อนไหวกับอัตราแลกเปลี่ยน'],
    'ท่องเที่ยว/โรงแรม/บริการอาหาร': ['รายได้ผูกกับจำนวนนักท่องเที่ยวต่างชาติและฤดูกาลท่องเที่ยว', 'อ่อนไหวกับต้นทุนพลังงาน/ค่าแรง และเหตุการณ์ที่กระทบการเดินทาง'],
    'สุขภาพ': ['รายได้ส่วนหนึ่งพึ่งพาคนไข้ต่างชาติ อ่อนไหวกับค่าเงินบาทและการเดินทางระหว่างประเทศ', 'ต้นทุนบุคลากรทางการแพทย์และเทคโนโลยีสูงขึ้นต่อเนื่อง'],
    'ขนส่ง/โครงสร้างพื้นฐาน': ['รายได้ผูกกับปริมาณผู้โดยสาร/การเดินทาง และการต่อ-ขยายสัมปทาน', 'เป็นธุรกิจลงทุนสูง อ่อนไหวกับดอกเบี้ยและนโยบายภาครัฐ'],
    'พัฒนาอสังหาริมทรัพย์': ['ยอดขาย/โอนอ่อนไหวกับอัตราดอกเบี้ยจำนองและความสามารถกู้ของผู้ซื้อ', 'จับตาสต๊อกที่อยู่อาศัยคงค้างและกำลังซื้อในแต่ละเซกเมนต์'],
    'เงินทุน/สินเชื่อ': ['คุณภาพสินเชื่อ (หนี้เสีย) อ่อนไหวกับภาวะเศรษฐกิจครัวเรือน', 'ต้นทุนทางการเงินเปลี่ยนตามทิศทางดอกเบี้ยนโยบาย'],
    'ชิ้นส่วนอิเล็กทรอนิกส์': ['รายได้ผูกกับวัฏจักรอุตสาหกรรมอิเล็กทรอนิกส์/ยานยนต์โลกและค่าเงินบาท', 'อ่อนไหวกับคำสั่งซื้อจากลูกค้าต่างประเทศรายใหญ่'],
    'วัสดุก่อสร้าง/บรรจุภัณฑ์': ['ความต้องการผูกกับภาคก่อสร้าง/อสังหาฯ ทั้งในและต่างประเทศ', 'ต้นทุนพลังงาน/วัตถุดิบมีผลต่อกำไรโดยตรง'],
    'ประกันชีวิต': ['ผลตอบแทนจากเงินลงทุนอ่อนไหวกับทิศทางดอกเบี้ยและตลาดทุน', 'จับตาสัดส่วนกรมธรรม์ใหม่และอัตราการต่ออายุ']
  };
  var COMPANY_INFO_EN = {
    ADVANC: { name: 'Advanced Info Service (AIS)', sector: 'ICT/Telecom', business: "Thailand's largest mobile network operator, also offering broadband and digital services" },
    AOT: { name: 'Airports of Thailand', sector: 'Transport/Infrastructure', business: "Operator of the country's major airports (Suvarnabhumi, Don Mueang, Chiang Mai, Phuket, Hat Yai); revenue mainly from airport fees and commercial concessions" },
    AWC: { name: 'Asset World Corp', sector: 'Tourism/Hotels/Food service', business: 'Retail real estate, hotel and office-space group under the TCC conglomerate' },
    BANPU: { name: 'Banpu', sector: 'Energy/Petrochemicals', business: 'Integrated coal and energy business in Thailand and abroad, including power generation and clean energy' },
    BBL: { name: 'Bangkok Bank', sector: 'Banking', business: "Thailand's largest commercial bank by assets, focused on large corporate and institutional clients" },
    BDMS: { name: 'Bangkok Dusit Medical Services', sector: 'Healthcare', business: "Thailand's largest private hospital network (Bangkok Hospital, Samitivej, BNH, etc.)" },
    BEM: { name: 'Bangkok Expressway and Metro', sector: 'Transport/Infrastructure', business: 'Operator of expressways (tollways) and the Blue/Purple Line MRT trains' },
    BGRIM: { name: 'B.Grimm Power', sector: 'Energy/Petrochemicals', business: 'Major private power producer focused on cogeneration plants and renewable energy' },
    BH: { name: 'Bumrungrad Hospital', sector: 'Healthcare', business: 'Premium private hospital focused on international patients and specialized medicine' },
    BTS: { name: 'BTS Group Holdings', sector: 'Transport/Infrastructure', business: 'Operator of the BTS Skytrain, also in media advertising and real estate' },
    CBG: { name: 'Carabao Group', sector: 'Food & Beverage', business: 'Maker of Carabao Dang energy drink and other beverages/consumer goods, domestic and overseas' },
    CENTEL: { name: 'Central Plaza Hotel', sector: 'Tourism/Hotels/Food service', business: 'Hotel business (Centara) and restaurants (KFC, Mister Donut, etc.) under Central Group' },
    COM7: { name: 'Com7', sector: 'Commerce/Retail', business: 'Major IT/mobile phone retailer (Banana, Studio 7, etc.), an authorized Apple reseller in Thailand' },
    CPALL: { name: 'CP All', sector: 'Commerce/Retail', business: "Operator of 7-Eleven convenience stores in Thailand, the country's largest, plus wholesale (Makro)" },
    CPF: { name: 'Charoen Pokphand Foods', sector: 'Food & Beverage', business: 'Integrated agro-industrial and food business (livestock/aquaculture, animal feed, processed food), a global-scale player' },
    CPN: { name: 'Central Pattana', sector: 'Real Estate Development', business: "Thailand's largest developer and operator of shopping malls (Central), plus residential and office buildings" },
    CRC: { name: 'Central Retail Corporation', sector: 'Commerce/Retail', business: 'Retail business under Central Group (department stores, supermarkets, etc.) in Thailand and abroad' },
    DELTA: { name: 'Delta Electronics (Thailand)', sector: 'Electronic Components', business: 'Electronic component maker focused on power supplies and energy management systems for global industry' },
    EA: { name: 'Energy Absolute', sector: 'Energy/Petrochemicals', business: 'Renewable energy (solar/wind) and electric vehicle/battery business' },
    EGCO: { name: 'Electricity Generating', sector: 'Energy/Petrochemicals', business: 'Major private power producer in Thailand and abroad' },
    GLOBAL: { name: 'Siam Global House', sector: 'Commerce/Retail', business: 'Integrated retail of construction materials and home improvement goods' },
    GPSC: { name: 'Global Power Synergy', sector: 'Energy/Petrochemicals', business: 'Core power business of the PTT Group, producing electricity and steam for industrial customers' },
    GULF: { name: 'Gulf Energy Development', sector: 'Energy/Petrochemicals', business: 'Major private power producer, expanding into infrastructure and digital businesses' },
    HMPRO: { name: 'Home Product Center', sector: 'Commerce/Retail', business: 'Home improvement/decor retail business (HomePro, Mega Home)' },
    INTUCH: { name: 'Intouch Holdings', sector: 'ICT/Telecom', business: 'Holding company with a major stake in ADVANC (AIS); revenue mainly from dividends' },
    IVL: { name: 'Indorama Ventures', sector: 'Energy/Petrochemicals', business: 'Global-scale petrochemical and fiber (PET/polyester) producer' },
    KBANK: { name: 'Kasikornbank', sector: 'Banking', business: 'Major Thai commercial bank offering loans, deposits and full financial services' },
    KCE: { name: 'KCE Electronics', sector: 'Electronic Components', business: 'Printed circuit board (PCB) manufacturer focused on exporting automotive/industrial components' },
    KKP: { name: 'Kiatnakin Phatra Bank', sector: 'Banking', business: 'Mid-sized commercial bank focused on auto loans and investment banking/wealth management' },
    KTB: { name: 'Krung Thai Bank', sector: 'Banking', business: 'State-controlled commercial bank focused on government and retail services' },
    KTC: { name: 'Krungthai Card', sector: 'Finance/Consumer credit', business: 'Major credit card and personal loan provider' },
    LH: { name: 'Land and Houses', sector: 'Real Estate Development', business: 'Major Thai property developer (housing estates, condominiums)' },
    MINT: { name: 'Minor International', sector: 'Tourism/Hotels/Food service', business: 'Hotel business (NH, Anantara), restaurants (The Pizza Company, Swensen’s) and lifestyle brand distribution' },
    MTC: { name: 'Muangthai Capital', sector: 'Finance/Consumer credit', business: 'Provider of vehicle-title loans and micro-lending' },
    OR: { name: 'PTT Oil and Retail Business', sector: 'Commerce/Retail', business: 'Gas station business (PTT Station) and in-station retail (Cafe Amazon)' },
    OSP: { name: 'Osotspa', sector: 'Food & Beverage', business: 'Maker of energy drinks (M-150) and consumer goods' },
    PTT: { name: 'PTT', sector: 'Energy/Petrochemicals', business: "Integrated natural gas, oil and petrochemical business, majority state-owned, Thailand's national energy company" },
    PTTEP: { name: 'PTT Exploration and Production', sector: 'Energy/Petrochemicals', business: 'Petroleum (oil/gas) exploration and production business, domestic and overseas' },
    PTTGC: { name: 'PTT Global Chemical', sector: 'Energy/Petrochemicals', business: 'Major petrochemical and chemicals producer under the PTT Group' },
    RATCH: { name: 'Ratch Group', sector: 'Energy/Petrochemicals', business: 'Private power producer (formerly Ratchaburi Electricity Generating), in Thailand and abroad' },
    SAWAD: { name: 'Srisawad Corporation', sector: 'Finance/Consumer credit', business: 'Major provider of vehicle-title loans and micro-lending' },
    SCB: { name: 'Siam Commercial Bank', sector: 'Banking', business: 'Major Thai commercial bank (held via SCB X), full-service retail and corporate banking' },
    SCC: { name: 'Siam Cement (SCG)', sector: 'Building Materials/Packaging', business: "Major Thai industrial group in construction materials, cement, petrochemicals and packaging" },
    SCGP: { name: 'SCG Packaging', sector: 'Building Materials/Packaging', business: 'Integrated packaging producer under the SCG Group' },
    TISCO: { name: 'Tisco Financial Group', sector: 'Banking', business: 'Financial group focused on auto loans and wealth management' },
    TLI: { name: 'Thai Life Insurance', sector: 'Life Insurance', business: "Major Thai life insurance company" },
    TOP: { name: 'Thai Oil', sector: 'Energy/Petrochemicals', business: 'Major Thai oil refinery under the PTT Group' },
    TRUE: { name: 'True Corporation', sector: 'ICT/Telecom', business: 'Telecom operator (mobile/internet) following the True-dtac merger' },
    TTB: { name: 'TMBThanachart Bank', sector: 'Banking', business: 'Commercial bank formed from the merger of TMB and Thanachart' },
    TU: { name: 'Thai Union Group', sector: 'Food & Beverage', business: 'Global-scale producer and exporter of processed seafood (canned tuna, etc.)' }
  };
  var SECTOR_FACTORS_EN = {
    'Banking': ['Earnings are sensitive to policy interest rates and loan quality (bad debt/NPL)', 'Watch quarterly earnings releases and Bank of Thailand policy'],
    'Energy/Petrochemicals': ['Profit swings with global oil/gas prices and refining/marketing margins', 'Government energy policy and price regulation directly affect the business'],
    'ICT/Telecom': ['Price/promotion competition in the mobile market, plus network investment costs', 'Part of revenue is tied to digital/internet consumer behavior'],
    'Commerce/Retail': ['Sales are sensitive to consumer purchasing power and tourism', 'Competition from e-commerce and branch/logistics costs'],
    'Food & Beverage': ['Input costs fluctuate with global commodity prices', 'Part of revenue relies on export markets, sensitive to exchange rates'],
    'Tourism/Hotels/Food service': ['Revenue is tied to foreign visitor numbers and travel seasonality', 'Sensitive to energy/labor costs and events that disrupt travel'],
    'Healthcare': ['Part of revenue relies on international patients, sensitive to the baht and cross-border travel', 'Medical staff and technology costs keep rising'],
    'Transport/Infrastructure': ['Revenue is tied to passenger/traffic volume and concession renewals/extensions', 'A capital-intensive business, sensitive to interest rates and government policy'],
    'Real Estate Development': ['Sales/transfers are sensitive to mortgage rates and buyers’ borrowing capacity', 'Watch unsold housing inventory and purchasing power in each segment'],
    'Finance/Consumer credit': ['Loan quality (bad debt) is sensitive to household economic conditions', 'Funding costs move with policy interest rate direction'],
    'Electronic Components': ['Revenue is tied to the global electronics/auto industry cycle and the baht', 'Sensitive to orders from large overseas customers'],
    'Building Materials/Packaging': ['Demand is tied to the construction/property sector, domestic and overseas', 'Energy/raw material costs directly affect profit'],
    'Life Insurance': ['Investment returns are sensitive to interest rates and capital markets', 'Watch new policy mix and renewal rates']
  };
  function getCompanyInfo(sym) { return (getUILang() === 'en' ? COMPANY_INFO_EN : COMPANY_INFO)[sym]; }
  function companyInfoUrl(sym) { return 'https://www.google.com/search?q=' + encodeURIComponent(sym + ' บริษัท ทำธุรกิจอะไร'); }
  function companyInfoHtml(sym) {
    var c = getCompanyInfo(sym);
    if (!c) {
      return '<div class="company-card"><div class="cname">' + t('noCompanyInfo') + '</div>' +
        '<div class="cbiz">' + t('companyInfoFallback', { url: companyInfoUrl(sym), sym: sym }) + '</div></div>';
    }
    var cTh = COMPANY_INFO[sym];
    var factors = (getUILang() === 'en' ? SECTOR_FACTORS_EN[c.sector] : SECTOR_FACTORS[cTh.sector]) || [];
    var html = '<div class="company-card"><span class="cname">' + c.name + '</span><span class="csector">' + c.sector + '</span>' +
      '<div class="cbiz">' + c.business + '</div>';
    if (factors.length) {
      html += '<ul class="creminders">' + factors.map(function (f) { return '<li>' + f + '</li>'; }).join('') + '</ul>';
    }
    html += '</div>';
    return html;
  }

  /* ── พอร์ต (หุ้นไทย) — เพิ่ม/ลบ/เช็ก "ควรขาย?" ─────────────────── */
  function addHolding() {
    var sym = ($('pfSym').value || '').trim().toUpperCase();
    var shares = num($('pfShares').value), cost = num($('pfCost').value);
    if (!sym) { window.tanotAlert(t('alertEnterSym')); return; }
    if (!isFinite(shares) || shares <= 0 || !isFinite(cost) || cost <= 0) { window.tanotAlert(t('alertEnterValid')); return; }
    var pf = loadPf(); pf.push({ sym: sym, shares: shares, cost: cost, ts: Date.now() });
    savePf(pf); $('pfSym').value = ''; $('pfShares').value = ''; $('pfCost').value = ''; renderPf();
  }
  function renderPf() {
    /* ในโหมดป๊อปอัพโฟกัสหุ้นตัวเดียว (EMBED_SYM) กรองให้เห็นแค่ตำแหน่งของสัญลักษณ์นั้น —
       ลบ/แก้ไขยังอ้างอิงกลับไปที่ array เต็ม (pfAll) ผ่าน object reference กันดัชนีเพี้ยน */
    var pfAll = loadPf(), box = $('pfBox');
    var pf = EMBED_SYM ? pfAll.filter(function (h) { return h.sym === EMBED_SYM; }) : pfAll;
    if (!pf.length) { box.innerHTML = '<div class="pf-empty">' + (EMBED_SYM ? t('pfEmptyEmbed', { sym: EMBED_SYM }) : t('pfEmptyDefault')) + '</div>'; return; }
    var html = '<table class="pf-table"><thead><tr><th>' + t('pfThSym') + '</th><th>' + t('pfThShares') + '</th><th>' + t('pfThCost') + '</th><th>' + t('pfThCur') + '</th><th>' + t('pfThPl') + '</th><th></th></tr></thead><tbody>';
    pf.forEach(function (h, i) {
      html += '<tr data-i="' + i + '"><td>' + h.sym + '</td><td>' + fmt0(h.shares) + '</td><td>' + fmt(h.cost) + '</td>' +
        '<td><input type="number" class="pf-price" inputmode="decimal" step="0.01" placeholder="' + t('pfPricePh') + '" value="' + (h.cur != null ? h.cur : '') + '"></td>' +
        '<td class="pf-pl">—</td><td class="pf-actions"><button class="pf-sell" title="' + t('pfSellTitle') + '">' + t('pfSellBtn') + '</button> <button class="pf-del" title="' + t('pfDelTitle') + '">✕</button></td></tr>' +
        '<tr class="pf-sellrow" data-sr="' + i + '"><td colspan="6"></td></tr>';
    });
    html += '</tbody></table>'; box.innerHTML = html;
    [].forEach.call(box.querySelectorAll('tr[data-i]'), function (tr) {
      var i = +tr.getAttribute('data-i'), h = pf[i], inp = tr.querySelector('.pf-price'), cell = tr.querySelector('.pf-pl');
      var sellCell = box.querySelector('tr[data-sr="' + i + '"] td');
      function upd() {
        var cur = num(inp.value);
        if (!isFinite(cur)) { cell.textContent = '—'; cell.className = 'pf-pl'; return; }
        var pl = (cur - h.cost) * h.shares, pct = (cur / h.cost - 1) * 100;
        cell.textContent = (pl >= 0 ? '+' : '−') + '฿' + fmt0(Math.abs(pl)) + ' (' + (pct >= 0 ? '+' : '') + fmt(pct, 1) + '%)';
        cell.className = 'pf-pl ' + (pl >= 0 ? 'up' : 'down');
      }
      inp.addEventListener('input', function () { upd(); h.cur = num(inp.value); savePf(pfAll); });
      tr.querySelector('.pf-del').addEventListener('click', function () { var realIdx = pfAll.indexOf(h); if (realIdx >= 0) pfAll.splice(realIdx, 1); savePf(pfAll); renderPf(); });
      tr.querySelector('.pf-sell').addEventListener('click', function () {
        sellCell.innerHTML = '<div class="sell-verdict warn">' + t('fetchingSellPrice', { sym: h.sym }) + '</div>';
        getSeries(h.sym).then(function (r) {
          var s = r.series, a = analyzeSeries(s), v = sellVerdict(a), price = s.closes[s.closes.length - 1];
          inp.value = price.toFixed(2); h.cur = price; savePf(pfAll); upd();
          var pl = (price - h.cost) * h.shares, pct = (price / h.cost - 1) * 100;
          sellCell.innerHTML = '<div class="sell-detail"><div class="sell-verdict ' + v.cls + '">' + v.headline +
            '<br><span style="font-weight:500">' + t('sellLatestPrice', { price: fmt(price) }) + (r.stale ? t('sellSavedAge', { age: cacheAgeText(r.cachedAt) }) : '') +
            t('sellCostLabel', { cost: fmt(h.cost) }) + (pl >= 0 ? t('sellProfit') : t('sellLoss')) + '฿' + fmt0(Math.abs(pl)) + ' (' + (pct >= 0 ? '+' : '') + fmt(pct, 1) + '%)</span>' +
            sellLevelsHtml(v.levels) + '</div>' +
            companyInfoHtml(h.sym) +
            '<div class="news-block"></div></div>';
          renderNewsBlock(sellCell.querySelector('.news-block'), h.sym);
        }, function () {
          sellCell.innerHTML = '<div class="sell-detail"><div class="sell-verdict warn">' + t('sellFetchFail', { sym: h.sym }) + '</div>' +
            companyInfoHtml(h.sym) + '</div>';
        });
      });
      upd();
    });
  }

  /* ── เช็กลิสต์ก่อนเข้าไม้ (GO/NO-GO) ─────────────────────────── */
  function checklistChecks() {
    var a = lastAnalysis, det = (a && a.det) ? a.det : {};
    var entry = num($('entry').value), stop = num($('stop').value), riskPct = num($('riskPct').value);
    var checks = [];
    if (a && isFinite(det.ema20)) {
      var up = isFinite(det.ema50) ? a.price >= det.ema50 : a.price >= det.ema20;
      var adxTxt = isFinite(det.adx) ? (det.adx >= 20 ? t('adxStrongTxt', { adx: det.adx.toFixed(0) }) : t('adxWeakTxt', { adx: det.adx.toFixed(0) })) : '';
      checks.push({ ok: up, txt: (up ? t('trendUpAdx') : t('trendNotUpAdx')) + adxTxt });
      var over = (a.price - det.ema20) / det.ema20, notChase = over <= 0.05;
      checks.push({ ok: notChase, txt: notChase ? t('notChasing') : t('chasing') });
    } else {
      checks.push({ ok: null, txt: t('needChartFirst') });
    }
    if (a && isFinite(det.rsi)) checks.push({ ok: det.rsi < 70, txt: det.rsi < 70 ? t('rsiOk', { rsi: det.rsi.toFixed(0) }) : t('rsiHot', { rsi: det.rsi.toFixed(0) }) });
    else checks.push({ ok: null, txt: t('rsiNeedChart') });
    var stopOk = isFinite(entry) && isFinite(stop) && stop < entry;
    checks.push({ ok: stopOk, txt: stopOk ? t('stopSetOk') : t('stopNotSet') });
    checks.push({ ok: isFinite(riskPct) && riskPct <= 2, txt: (isFinite(riskPct) && riskPct <= 2) ? t('riskOk', { pct: riskPct }) : t('riskHigh', { pct: isFinite(riskPct) ? riskPct + '%' : '-' }) });
    if (a && isFinite(a.resistance) && stopOk && a.resistance > entry) {
      var rr = (a.resistance - entry) / (entry - stop), rrOk = rr >= 2;
      checks.push({ ok: rrOk, txt: rrOk ? t('rrOk', { rr: rr.toFixed(1) }) : t('rrLow', { rr: rr.toFixed(1) }) });
    } else {
      checks.push({ ok: null, txt: t('rrNeedInfo') });
    }
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
      var ic = c.ok === true ? '✓' : c.ok === false ? '✕' : '◻️';
      html += '<li class="' + (c.ok === false ? 'fail' : 'pass') + '"><span class="ic">' + ic + '</span><span>' + c.txt + '</span></li>';
    });
    $('chkList').innerHTML = html;
    box.style.display = 'block';
  }

  /* ── Expectancy ─────────────────────────────────────────────── */
  function doExpectancy() {
    var w = num($('eWin').value) / 100, wr = num($('eWinR').value), lr = num($('eLossR').value);
    var box = $('eResult');
    if (!(w >= 0 && w <= 1) || !isFinite(wr) || !isFinite(lr) || wr < 0 || lr <= 0) {
      box.className = 'verdict-box warn'; box.textContent = t('expInvalid'); box.style.display = 'block'; return;
    }
    var exp = w * wr - (1 - w) * lr;
    var beWin = lr / (wr + lr) * 100;
    var msg = t('expMsg', { sign: exp >= 0 ? '+' : '', exp: exp.toFixed(2), sign2: exp >= 0 ? '+' : '−', bahtExp: fmt0(Math.abs(exp) * 1000), beWin: beWin.toFixed(0) });
    if (exp > 0.1) { box.className = 'verdict-box go'; box.innerHTML = t('expGood', { msg: msg }); }
    else if (exp > 0) { box.className = 'verdict-box warn'; box.innerHTML = t('expBreakeven', { msg: msg }); }
    else { box.className = 'verdict-box no'; box.innerHTML = t('expBad', { msg: msg }); }
    box.style.display = 'block';
  }

  /* ══════ ข่าวล่าสุด (best-effort) — ไม่บล็อกอะไร ถ้าดึงไม่ได้มีลิงก์ค้นเองเสมอ ══════ */
  function newsSearchUrl(sym) {
    return 'https://news.google.com/search?q=' + encodeURIComponent(sym + ' หุ้น') + '&hl=th&gl=TH&ceid=TH:th';
  }
  function parseNewsRss(t) {
    var xml = new DOMParser().parseFromString(t, 'text/xml');
    if (xml.querySelector('parsererror')) throw new Error('parse error');
    var items = [].slice.call(xml.querySelectorAll('item')).slice(0, 5).map(function (it) {
      var title = it.querySelector('title'), link = it.querySelector('link'), pub = it.querySelector('pubDate');
      return { title: title ? title.textContent : '', link: link ? link.textContent : '#', pubDate: pub ? pub.textContent : '' };
    }).filter(function (n) { return n.title; });
    if (!items.length) throw new Error('no items');
    return items;
  }
  function newsDateShort(pubDate) {
    var d = pubDate ? new Date(pubDate) : null;
    return (d && !isNaN(d)) ? d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : '';
  }
  /* rss2json.com — บริการแปลง RSS→JSON โดยเฉพาะ ลองก่อนเป็นอันดับแรกเสมอ (เหมือนที่ invest-news.js ใช้)
     มักเสถียรกว่าพร็อกซี CORS ทั่วไปที่แค่ยืมมาใช้ผ่านๆ เพราะออกแบบมาสำหรับงานนี้ตรงๆ */
  function parseRss2Json(t) {
    var o = JSON.parse(t);
    if (!o || o.status !== 'ok' || !Array.isArray(o.items) || !o.items.length) throw new Error('rss2json empty');
    var items = o.items.slice(0, 5).map(function (it) {
      var title = (it.title || '').replace(/\s-\s[^-]+$/, ''); // ตัดชื่อสำนักข่าวท้ายหัวข้อออก (หน้านี้ไม่ได้แสดงที่มาอยู่แล้ว)
      return { title: title, link: it.link || '#', pubDate: it.pubDate || '' };
    }).filter(function (n) { return n.title; });
    if (!items.length) throw new Error('no items');
    return items;
  }
  function fetchNewsScan(sym) {
    var base = 'https://news.google.com/rss/search?q=' + encodeURIComponent(sym + ' หุ้น OR บริษัท') + '&hl=th&gl=TH&ceid=TH:th';
    var enc = encodeURIComponent(base);
    var tries = [
      { url: 'https://api.rss2json.com/v1/api.json?rss_url=' + enc, parser: parseRss2Json },
      { url: 'https://api.allorigins.win/raw?url=' + enc, parser: parseNewsRss },
      { url: 'https://api.codetabs.com/v1/proxy/?quest=' + enc, parser: parseNewsRss },
      { url: 'https://cors.eu.org/' + base, parser: parseNewsRss },
      { url: 'https://test.cors.workers.dev/?' + base, parser: parseNewsRss },
      { url: 'https://api.cors.lol/?url=' + enc, parser: parseNewsRss },
      { url: 'https://proxy.corsfix.com/?' + base, parser: parseNewsRss },
      { url: base, parser: parseNewsRss }
    ];
    var i = 0;
    function next() {
      if (i >= tries.length) return Promise.reject(new Error('all failed'));
      var t = tries[i++];
      return fetchOne(t.url, 7000, t.parser).catch(function () { return next(); });
    }
    return next();
  }
  function newsCacheKey(sym) { return 'tanot:invest:newscache:' + sym; }
  function saveNewsCache(sym, items) { try { localStorage.setItem(newsCacheKey(sym), JSON.stringify({ ts: Date.now(), items: items })); } catch (e) {} }
  function loadNewsCache(sym) { try { var o = JSON.parse(localStorage.getItem(newsCacheKey(sym))); return (o && o.items) ? o : null; } catch (e) { return null; } }
  function fetchNews(sym) {
    var cached = loadNewsCache(sym), fresh = cached && (Date.now() - cached.ts < 8 * 3600 * 1000);
    if (fresh) return Promise.resolve({ items: cached.items, stale: false });
    return fetchNewsScan(sym).then(function (items) {
      saveNewsCache(sym, items); return { items: items, stale: false };
    }, function (e) {
      if (cached) return { items: cached.items, stale: true };
      throw e;
    });
  }
  function renderNewsBlock(el, sym) {
    if (!el) return;
    lastNewsItems = null;
    var link = '<a class="news-search-link" target="_blank" rel="noopener" href="' + newsSearchUrl(sym) + '">' + t('searchNewsMyself') + '</a>';
    el.innerHTML = t('searchingNews', { sym: sym }) + link;
    fetchNews(sym).then(function (r) {
      var html = '<ul class="news-list">' + r.items.map(function (n) {
        return '<li><a href="' + n.link + '" target="_blank" rel="noopener">' + n.title + '</a><span class="news-date">' + newsDateShort(n.pubDate) + '</span></li>';
      }).join('') + '</ul>' + t('moreNews') + link;
      el.innerHTML = html;
      lastNewsItems = r.items;
    }, function () {
      el.innerHTML = t('newsAutoFail') + link;
    });
  }

  /* ── แท็บภายในหน้า (ภาพรวม / ข่าวและปฏิทิน) ── */
  function initPageTabs() {
    var tabs = document.querySelectorAll('#pageTabs button');
    tabs.forEach(function (b) {
      b.addEventListener('click', function () {
        tabs.forEach(function (x) { x.classList.toggle('on', x === b); });
        document.querySelectorAll('.tabpanel').forEach(function (p) { p.classList.toggle('on', p.id === 'p-' + b.dataset.t); });
        if (b.dataset.t === 'ov') setTimeout(reflow, 60);
      });
    });
  }

  /* ── แถบนำทาง: กลุ่ม/แท็บย่อยจาก window.INVEST_CATS ── */
  function initNav() {
    function waitCats(cb) { if (window.INVEST_CATS) cb(window.INVEST_CATS); else setTimeout(function () { waitCats(cb); }, 30); }
    waitCats(function (CATS) {
      var row = $('ivSubRow-market'); if (!row) return;
      CATS.forEach(function (c) {
        if (['thai-stock', 'global-stock', 'thai-fund', 'global-fund', 'gold', 'bitcoin', 'commodities'].indexOf(c.key) < 0) return;
        var a = document.createElement('a'); a.href = c.page; a.textContent = c.label;
        if (c.key === 'thai-stock') a.className = 'on';
        row.appendChild(a);
      });
      var scan = document.createElement('a'); scan.href = 'invest-set50-scanner.html'; scan.id = 'ivScannerLink';
      scan.innerHTML = '<b>' + t('scannerLink') + '</b>';
      row.appendChild(scan);
    });
    var groupBtns = document.querySelectorAll('#ivGroups button');
    groupBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.href) { location.href = b.dataset.href; return; }
        groupBtns.forEach(function (x) { x.classList.toggle('on', x === b); });
      });
    });
  }

  /* ── init ───────────────────────────────────────────────────── */
  function init() {
    applyStaticI18n();
    initNav();
    initPageTabs();
    $('verdictChip').addEventListener('click', function () { $('whyBox').hidden = !$('whyBox').hidden; });
    $('fetchBtn').addEventListener('click', doFetch);
    initLiveControls();
    $('analyzeBtn').addEventListener('click', doAnalyze);
    $('demoBtn').addEventListener('click', doDemo);
    $('pasteBtn').addEventListener('click', doPaste);
    $('calcBtn').addEventListener('click', doCalc);
    $('sym').addEventListener('keydown', function (e) { if (e.key === 'Enter') doFetch(); });
    ['price', 'hi', 'lo'].forEach(function (id) { $(id).addEventListener('input', function () { lastSeries = null; }); });

    $('tfGroup').addEventListener('click', function (e) { var b = e.target.closest('.tf'); if (b) applyTF(+b.getAttribute('data-tf')); });
    $('tgGroup').addEventListener('click', function (e) { var b = e.target.closest('.tg'); if (!b) return; var k = b.getAttribute('data-tg'); tg[k] = !tg[k]; applyToggles(); });

    $('saveBtn').addEventListener('click', function () {
      var d = $('saveBtn')._data; if (!d) return;
      var pf = loadPf(); pf.push({ sym: d.sym, shares: d.shares, cost: d.cost, ts: Date.now() });
      savePf(pf); renderPf();
      $('saveBtn').textContent = t('savedBtn');
      setTimeout(function () { $('saveBtn').innerHTML = t('saveToPortfolioBtn'); }, 1500);
    });
    $('checkBtn').addEventListener('click', doChecklist);
    $('eBtn').addEventListener('click', doExpectancy);
    $('pfAdd').addEventListener('click', addHolding);
    $('aiSumBtn').addEventListener('click', doAiSummary);
    renderPf();
    DriveSync.onPfChange(renderPf);
    DriveSync.init();

    /* ?sym=XXX — มาจากสแกนเนอร์ SET50 หรือลิงก์ตรง */
    var qsym = new URLSearchParams(location.search).get('sym');
    if (qsym) { $('sym').value = qsym.toUpperCase(); doFetch(); }
  }
  function doCalc() {
    var capital = num($('capital').value), riskPct = num($('riskPct').value);
    var entry = num($('entry').value), stop = num($('stop').value), comm = num($('comm').value), commMin = num($('commMin').value);
    if (!isFinite(entry)) entry = num($('price').value);
    if (!isFinite(entry)) { setStatus(t('enterEntryFirst'), 'err'); return; }
    if (!isFinite(stop)) { stop = (lastAnalysis && isFinite(lastAnalysis.suggestStop)) ? lastAnalysis.suggestStop : entry * 0.95; $('stop').value = stop.toFixed(2); }
    if (!isFinite(capital) || capital <= 0) { capital = 100000; $('capital').value = capital; }
    if (!isFinite(riskPct) || riskPct <= 0) { riskPct = 2; $('riskPct').value = riskPct; }
    if (!isFinite(comm) || comm < 0) { comm = 0.157; $('comm').value = comm; }
    if (!isFinite(commMin) || commMin < 0) { commMin = 50; $('commMin').value = commMin; }

    var res = riskCalc({ capital: capital, riskPct: riskPct, entry: entry, stop: stop, comm: comm, commMin: commMin, resistance: lastAnalysis ? lastAnalysis.resistance : NaN });
    var box = $('riskResult');
    if (res.error) {
      $('riskHeadline').innerHTML = '<span style="color:var(--err)">' + res.error + '</span>';
      $('riskKv').innerHTML = ''; $('tpRow').innerHTML = ''; box.classList.add('show'); $('saveBtn').style.display = 'none'; return;
    }
    $('riskHeadline').innerHTML = t('calcHeadline', { shares: fmt0(res.shares), lots: fmt0(res.lots), cost: fmt0(res.cost) });
    var kv = '';
    kv += '<div class="k">' + t('kvRiskIfWrong') + '</div><div class="v risk">฿' + fmt0(res.riskBaht) + '</div>';
    kv += '<div class="k">' + t('kvStopPrice') + '</div><div class="v">' + fmt(stop) + '</div>';
    kv += '<div class="k">' + t('kvCommRoundtrip') + '</div><div class="v">฿' + fmt0(res.commBaht) + ' (' + fmt(res.commPct, 1) + '%)</div>';
    kv += '<div class="k">' + t('kvBreakeven') + '</div><div class="v">' + fmt(res.breakeven) + '</div>';
    if (isFinite(res.rr)) kv += '<div class="k">' + t('kvRR') + '</div><div class="v">' + fmt(res.rr, 1) + ' : 1</div>';
    $('riskKv').innerHTML = kv;
    $('tpRow').innerHTML = '<span class="tp-chip">' + t('tpLot1', { price: fmt(res.tp1) }) + '</span><span class="tp-chip">' + t('tpLot2', { price: fmt(res.tp2) }) + '</span><span class="tp-chip">' + t('tpLot3', { price: fmt(res.tp3) }) + '</span>';
    if (res.note) $('tpRow').innerHTML += '<div style="flex:1 1 100%;font-size:12px;color:var(--warn);margin-top:6px">ℹ️ ' + res.note + '</div>';
    if (res.minKicksIn) $('tpRow').innerHTML += '<div style="flex:1 1 100%;font-size:12px;color:var(--warn);margin-top:6px">⚠️ ' + t('commMinNote', { min: fmt0(commMin), pct: fmt(res.commPct, 1), breakeven: fmt(res.breakeven) }) + '</div>';
    box.classList.add('show');
    $('saveBtn').style.display = 'inline-flex';
    $('saveBtn')._data = { sym: ($('sym').value || '').trim().toUpperCase() || t('thisStock'), shares: res.shares, cost: entry };
  }

  window.omeApplyLang = function () {
    applyStaticI18n();
    var scanLink = document.getElementById('ivScannerLink');
    if (scanLink) scanLink.innerHTML = '<b>' + t('scannerLink') + '</b>';
    if ($('shead').style.display === 'flex' && $('stkSym').textContent) {
      updateStockHead(lastSource && lastSource.kind === 'demo' ? t('sampleWord') : $('stkSym').textContent);
    }
    if (lastSeries) useSeries(lastSeries);
    renderPf();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.__thstock = { sma: sma, emaLast: emaLast, rsi: rsi, rsiSeries: rsiSeries, smaSeries: smaSeries, macd: macd, bollinger: bollinger, atr: atr, analyzeSeries: analyzeSeries, analyzeSimple: analyzeSimple, riskCalc: riskCalc, demoData: demoData, parsePaste: parsePaste, parseYahoo: parseYahoo, checklistChecks: checklistChecks, adx: adx, psar: psar, sellVerdict: sellVerdict, companyInfoHtml: companyInfoHtml, newsSearchUrl: newsSearchUrl, parseNewsRss: parseNewsRss };
})();
