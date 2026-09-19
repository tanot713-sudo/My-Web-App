/* ══════════════════════════════════════════════════════════════════
   Tanot — หุ้นต่างประเทศ (สหรัฐฯ · มือใหม่ · สวิง)
   • กราฟแท่งเทียนจริงด้วย lightweight-charts (TradingView, Apache-2.0)
   • ดึงราคาหุ้น US แบบ best-effort หลายเส้นทาง (มัก CORS บน static → มีตัวอย่าง/กรอกเองสำรอง)
   • คำนวณอินดิเคเตอร์เอง (SMA/EMA/RSI/MACD/Bollinger/ATR) → แปลเป็นไฟจราจร
   • แกนหลัก: คุมเงิน/ความเสี่ยง เป็น USD (ซื้อหุ้นเดี่ยวได้ ไม่ต้องเป็นล็อต), stop, TP, จุดคุ้มทุน — พอร์ตเก็บใน localStorage
   • ตัวแปลงเป็นเงินบาทเสริม (ไม่บังคับ) — ดึงอัตราแบบ best-effort หรือกรอกเอง
   หมายเหตุ: ตัวช่วยคิด ไม่ใช่คำแนะนำการลงทุน
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var PF_KEY = 'tanot:invest:globalstock';
  var lastSeries = null;
  var lastAnalysis = null;

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }
  function fmt(n, d) { d = d == null ? 2 : d; return isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'; }
  function fmt0(n) { return isFinite(n) ? Math.round(n).toLocaleString('en-US') : '—'; }
  function usd(n, d) { if (!isFinite(n)) return '—'; var neg = n < 0; d = d == null ? 2 : d; return (neg ? '−' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function usd0(n) { if (!isFinite(n)) return '—'; var neg = n < 0; return (neg ? '−' : '') + '$' + Math.round(Math.abs(n)).toLocaleString('en-US'); }
  function baht(n) { if (!isFinite(n)) return '—'; var neg = n < 0; return (neg ? '−' : '') + '฿' + Math.round(Math.abs(n)).toLocaleString('th-TH'); }

  /* ══════ ระบบแปลภาษา (i18n) ══════
     รูปแบบเดียวกับ invest.html/invest-thai-stock.js: I18N dict + t() + data-i18n/-html/-placeholder
     attributes + window.omeApplyLang (เรียกอัตโนมัติจากเมนูตั้งค่ากลางตอนสลับภาษา) */
  var UI_LANG_KEY = 'ome:lang';
  function getUILang() { try { return localStorage.getItem(UI_LANG_KEY) === 'en' ? 'en' : 'th'; } catch (e) { return 'th'; } }
  var I18N = {
    th: {
      crumbHome: 'การลงทุน', crumbHere: 'หุ้นต่างประเทศ',
      pageTitle: 'หุ้นต่างประเทศ — ตัวช่วยเข้า/ออก',
      step1Title: 'ราคาหุ้นตอนนี้', symLabel: 'ชื่อย่อหุ้น (เช่น AAPL, MSFT)', fetchBtn: 'ลองดึงราคา',
      priceNowLabel: 'ราคาตอนนี้ (USD)', priceNowPh: 'เช่น 180.50', priceHiLabel: 'ราคาสูงสุดของรอบ', priceLoLabel: 'ราคาต่ำสุดของรอบ', periodPh: 'ช่วง 3 เดือน',
      liveModeHistorical: 'โหมดข้อมูล: ย้อนหลัง', liveMetaDefault: 'ตั้งค่าแหล่งข้อมูลสดได้ใน "ตั้งค่าข้อมูลตลาด"',
      refreshBtn: '↻ รีเฟรช', marketSettingsBtn: '⚙️ ตั้งค่าข้อมูลตลาด',
      marketSettingsTitle: 'ข้อมูลตลาดแบบสด', providerLabel: 'แหล่งข้อมูล', providerGateway: 'Tanot Data Gateway (แนะนำ)', providerYahoo: 'Yahoo / ย้อนหลัง',
      gatewayUrlLabel: 'Gateway URL', apiKeyLabel: 'Twelve Data API Key', apiKeyNote: '(เก็บในเครื่องเท่านั้น)', apiKeyPh: 'ใส่เมื่อมี API key',
      intervalLabel: 'รีเฟรชทุก', interval5: '5 วินาที', interval10: '10 วินาที', interval30: '30 วินาที',
      saveSettingsBtn: 'บันทึกการตั้งค่า', clearApiKeyBtn: 'ล้าง API Key',
      analyzeBtn: 'ประเมินให้หน่อย', demoBtn: 'ดูกราฟตัวอย่าง (ฝึกอ่าน)',
      pasteSummary: 'วางราคาย้อนหลังเอง (ทางเลือก)', pasteHint: 'วางราคาปิดหลายวัน คั่นด้วยเว้นวรรค/บรรทัด/จุลภาค (เรียงเก่า→ใหม่)', pasteBtn: 'ใช้ราคานี้',
      fxSummary: 'แปลงเป็นเงินบาท (ทางเลือก)', fxDesc: 'เปิดไว้เพื่อดูยอด ≈ บาท กำกับควบคู่กับตัวเลข USD ในหน้านี้ (ไม่บังคับ ไม่กระทบการคำนวณหลักซึ่งเป็น USD เสมอ)',
      fxRateLabel: 'อัตราแลกเปลี่ยน', fxRatePh: 'เช่น 36.00', unitBahtPerUsd: '(บาทต่อ 1 USD)', fxFetchBtn: 'ดึงอัตราปัจจุบัน', fxShowLabel: 'แสดงยอดเทียบเงินบาท (≈ ฿) ในหน้านี้',
      ulTitle: 'หุ้นดัง (US)', scanBtn: 'หาหุ้นน่าสนใจ', scanBtnStop: '⏹ หยุด', greenOnlyLabel: 'เฉพาะไฟเขียว',
      ulThSym: 'หลักทรัพย์', ulThLast: 'ล่าสุด', ulThChg: '+/−', ulThPct: '%', ulThSig: 'สัญญาณ', ulRowLoading: 'กดดู',
      techDetailsSummary: 'ดูรายละเอียดทางเทคนิค (ไม่ต้องเข้าใจก็ได้)', chartTitle: 'กราฟราคา',
      tf1m: '1เดือน', tf3m: '3เดือน', tf6m: '6เดือน', tf1y: '1ปี',
      tgMa20: 'เฉลี่ย 20', tgMa50: 'เฉลี่ย 50', tgVol: 'Volume', tgRsi: 'RSI',
      capUp: 'แท่งขึ้น', capDn: 'แท่งลง', capMa20: 'เฉลี่ย 20 วัน', capMa50: 'เฉลี่ย 50 วัน', capTouch: 'แตะบนกราฟเพื่อดูราคาแต่ละวัน',
      step2Title: 'ถ้าจะซื้อ ควรใส่เงินเท่าไร ตั้งขายที่ไหน', capitalLabel: 'เงินลงทุนทั้งพอร์ต (USD)', capitalPh: 'เช่น 10000',
      riskPctLabel: 'ยอมเสี่ยงต่อไม้', unitPctPortfolio: '(% ของพอร์ต)', entryLabel: 'ราคาเข้าซื้อ (USD)', entryPh: '= ราคาตอนนี้',
      stopLabel: 'ราคาตัดขาดทุน (Stop)', stopPh: 'แนะนำอัตโนมัติ', commLabel: 'ค่าคอมฯ', unitPctPerTrade: '(% ต่อครั้ง)',
      calcBtn: 'คำนวณ', saveToPortfolioBtn: 'บันทึกเข้าพอร์ต', savedBtn: 'บันทึกแล้ว',
      checklistTitle: 'ตรวจก่อนเข้าไม้ — ควรซื้อไหม?', checklistDesc: 'เช็กวินัย 6 ข้อ ก่อนกดซื้อจริง (กันซื้อตามอารมณ์/ไล่ราคา) — กด "ประเมิน" และ "คำนวณ" ด้านบนก่อน แล้วกดปุ่มนี้', checkBtn: 'ตรวจเช็กลิสต์',
      driveTitle: 'สำรองพอร์ต + สมุดเทรดขึ้น Google Drive',
      driveConnectBtn: 'เชื่อมต่อ Google Drive', driveConnectedBtn: 'เชื่อมต่อ Google Drive แล้ว',
      pfTitle: 'พอร์ตของฉัน',
      pfSymLabel: 'ชื่อหุ้น', pfSharesLabel: 'จำนวนหุ้น', pfCostLabel: 'ราคาต้นทุน/หุ้น', pfAddBtn: '+ เพิ่มเข้าพอร์ต',
      pfEmptyDefault: 'ยังไม่มีหุ้นในพอร์ต',
      pfThSym: 'หุ้น', pfThShares: 'จำนวน', pfThCost: 'ต้นทุน/หุ้น', pfThCur: 'ราคาปัจจุบัน', pfThPl: 'กำไร/ขาดทุน',
      pfPricePh: 'ราคา', pfSellTitle: 'เช็กควรขาย?', pfSellBtn: 'ควรขาย?', pfDelTitle: 'ลบ',
      journalTitle: 'สมุดเทรด + สถิติ (ดู "ฝีมือ" ตัวเอง)',
      jSymLabel: 'หุ้น', jEntryLabel: 'ราคาเข้า', jExitLabel: 'ราคาออก', jSharesLabel: 'จำนวนหุ้น', jAddBtn: '+ บันทึก',
      jStatCount: 'จำนวนไม้', jStatWinRate: 'อัตราชนะ', jStatTotalPl: 'กำไร/ขาดทุนรวม', jStatExpectancy: 'คาดหวัง/ไม้',
      jThSym: 'หุ้น', jThEntry: 'เข้า', jThExit: 'ออก', jThShares: 'จำนวน', jThResult: 'ผล',
      jEmptyDefault: 'ยังไม่มีไม้ที่บันทึก — ปิดไม้แล้วบันทึกทุกครั้ง จะเห็นสถิติจริงของตัวเอง', jSymFallback: 'หุ้น',
      expectancyTitle: 'ระบบเทรดของคุณ "กำไรระยะยาว" ไหม?',
      eWinLabel: 'อัตราชนะ', unitPctWinTrades: '(% ของไม้ที่ชนะ)', eWinRLabel: 'กำไรเฉลี่ยตอนชนะ', unitR: '(เท่าของความเสี่ยง R)', eLossRLabel: 'ขาดทุนเฉลี่ยตอนแพ้', unitR2: '(R)',
      realityTitle: 'อ่านก่อนเอาเงินมาลงทุน (สำคัญมาก)',
      reality1: 'ลงทุนหุ้น <b>เฉพาะเงินที่ไม่ต้องใช้อย่างน้อย 3–5 ปี</b> — เงินที่หายได้โดยไม่กระทบชีวิต',
      reality2: 'มี <b>เงินสำรองฉุกเฉิน 3–6 เดือน</b> ก่อนเริ่มเสมอ',
      reality3: '<b>ห้ามเด็ดขาด</b>: เอาเงินค่ากิน ค่าเช่า เงินกู้ หรือเงินที่ต้องใช้เร็วๆ มาเทรด',
      reality4: 'การเทรดหุ้น <b>ไม่ใช่รายได้เสริมที่มั่นคง/เร็ว</b> — มือใหม่ส่วนใหญ่ขาดทุนปีแรก โดยเฉพาะตอนร้อนเงิน',
      reality5: 'หุ้นต่างประเทศมี <b>ความเสี่ยงอัตราแลกเปลี่ยน</b> เพิ่มเข้ามาอีกชั้น — ถึงหุ้นจะกำไรเป็น USD แต่ถ้าเงินบาทแข็งขึ้นมาก กำไรตีกลับเป็นบาทอาจลดลงได้',
      realityCta: 'ถ้าตอนนี้เงินตึงและอยากได้เงินงอกแบบเสี่ยงต่ำ วิธีที่ปลอดภัยกว่าเก็งหุ้นรายตัวมากคือ <b>ทยอยลงทุนกองทุนดัชนี (DCA)</b> — <a href="invest-global-fund.html">ลองเครื่องวางแผนกองทุน S&amp;P500 →</a>',
      ageJustNow: 'เมื่อสักครู่', ageMinsAgo: '{n} นาทีก่อน', ageHrsAgo: '{n} ชม.ก่อน', ageDaysAgo: '{n} วันก่อน',
      liveModePrefix: 'โหมดข้อมูล: ', liveHistoricalLabel: 'ย้อนหลัง / Historical', liveHistoricalMeta: 'ใช้ Yahoo สำหรับกราฟย้อนหลัง',
      liveLiveLabel: 'สด / Real-time', liveFallbackLabel: 'สำรอง / Historical', liveFallbackMeta: 'แหล่งข้อมูลสดยังเชื่อมต่อไม่ได้ · ใช้ราคาย้อนหลังเป็น fallback',
      liveQuoteMeta: '{source} · {ch}{pct} · อัปเดต {tm}', liveQuoteStatus: 'ราคาล่าสุด {price} USD · {source} · {tm}',
      enterPriceFirst: 'กรอกอย่างน้อย "ราคาตอนนี้" ก่อนนะครับ', gapNeedInfo: 'กรอกราคาสูง/ต่ำของรอบ เพื่อประเมินถูก-แพง',
      gapNeedInfoWhy: 'หรือกด "ดูกราฟตัวอย่าง (ฝึกอ่าน)" เพื่อลองเล่นกราฟ — ตอนนี้ทำได้เฉพาะคำนวณเงินด้านล่าง',
      chartLibFail: 'โหลดไลบรารีกราฟไม่ได้ (ลองออนไลน์แล้วรีเฟรช) — ส่วนไฟจราจร/คำนวณเงินยังใช้ได้',
      typeSymFirst: 'พิมพ์ชื่อย่อหุ้นก่อน เช่น AAPL', fetchingData: 'กำลังดึงข้อมูล {sym}…',
      liveFromMsg: 'ราคา {sym} สดจาก {source} · กราฟย้อนหลัง {days} วัน',
      staleDataMsg: 'แหล่งข้อมูลสดใช้ไม่ได้ · ใช้ข้อมูลย้อนหลังที่บันทึกไว้ ({age}) · {days} วัน',
      histFromMsg: 'ขณะนี้ใช้ราคาย้อนหลังจาก {source} · {days} วัน',
      notFoundMsg: 'ไม่พบข้อมูลของ {sym} — ตรวจชื่อหุ้นหรือการเชื่อมต่อข้อมูลตลาด',
      demoMsg: 'กำลังแสดง "ข้อมูลตัวอย่าง" (ไม่ใช่ราคาจริง) — ไว้ลองเล่นกราฟและฝึกอ่าน',
      pasteAtLeast5: 'วางราคาปิดอย่างน้อย 5 วันก่อนนะครับ', pastedMsg: 'ใช้ราคาที่วางแล้ว ({days} วัน)',
      settingsSaved: 'บันทึกการตั้งค่าแล้ว · ระบบจะดึงข้อมูลตามช่วงเวลาที่ตั้ง', apiKeyCleared: 'ล้าง API Key จากเครื่องแล้ว',
      demoBadge: 'ข้อมูลตัวอย่าง — ไม่ใช่ราคาจริง (ไว้ฝึกอ่านกราฟ)', pastedBadge: 'ราคาที่วางเอง · {days} วัน',
      realBadge: '{label} · {status} · {days} วัน', realBadgeLabel: 'ราคาจริง', staleLatestPrice: 'ราคาล่าสุด {age}',
      legendOpen: 'เปิด {v}', legendHigh: 'สูง {v}', legendLow: 'ต่ำ {v}', legendClose: 'ปิด {v}',
      detEma20: 'เส้นเฉลี่ย 20 วัน (EMA20)', detEma50: 'เส้นเฉลี่ย 50 วัน (EMA50)', detRsi: 'RSI (14)', detMacd: 'MACD histogram',
      detBbUpper: 'กรอบบน (Bollinger)', detBbLower: 'กรอบล่าง (Bollinger)', detAtr: 'ATR (ความผันผวน)',
      detSupport: 'แนวรับล่าสุด', detResistance: 'แนวต้านล่าสุด', detAdx: 'ความแรงแนวโน้ม (ADX 14)',
      detAdxStrong: ' · แข็งแรง', detAdxWeak: ' · อ่อน', detSar: 'จุดตัดขาดทุนตาม (Parabolic SAR)', detSarUp: ' · เทรนด์ขึ้น', detSarDn: ' · เทรนด์ลง', detNoData: '—',
      vInteresting: 'น่าสนใจ — ลองพิจารณา', vCareful: 'ระวัง — ยังไม่ใช่จังหวะ', vWait: 'รอก่อน — ยังไม่มีจังหวะเด่น',
      whyCheapRange: 'ราคาอยู่ช่วงถูกเทียบ 3 เดือน', whyExpensiveRange: 'ราคาอยู่ช่วงแพงเทียบ 3 เดือน',
      whyRsiLow: 'แรงขายเริ่มคลาย (RSI ต่ำ กำลังฟื้น)', whyRsiHigh: 'ราคาร้อนแรงเกินไป (RSI สูง เสี่ยงย่อ)',
      whyMomUp: 'โมเมนตัมเริ่มกลับเป็นบวก', whyMomDn: 'โมเมนตัมเริ่มอ่อนลง',
      whyUptrend: 'ยังอยู่ในแนวโน้มขึ้น', whyDowntrend: 'อยู่ใต้เส้นแนวโน้ม (ขาลง/พักตัว)',
      whyBbLow: 'ราคาแตะกรอบล่าง (มักเป็นจังหวะเด้ง)', whyBbHigh: 'ราคาชนกรอบบน', whyNeutral: 'ราคาอยู่กลางกรอบ ยังไม่มีสัญญาณชัด',
      vExpensive: 'ระวัง — ราคาค่อนข้างแพง', vMid: 'รอก่อน — ราคากลางกรอบ',
      whyCheapPct: 'ราคาอยู่ค่อนไปทางถูกของรอบ (~{pct}% ของช่วง ต่ำ→สูง)', whyExpensivePct: 'ราคาอยู่ค่อนไปทางแพงของรอบ (~{pct}% ของช่วง ต่ำ→สูง)', whyMidPct: 'ราคาอยู่กลางกรอบ (~{pct}% ของช่วง ต่ำ→สูง)',
      stopMustBeLower: 'ราคาตัดขาดทุนต้องต่ำกว่าราคาเข้าซื้อ', minShareNote: 'ขั้นต่ำ 1 หุ้น ทำให้ความเสี่ยงเกิน {riskPct}% ที่ตั้งไว้เล็กน้อย — พิจารณาขยับ stop ให้แคบลง หรือเพิ่มทุน',
      capitalLimitNote: 'จำกัดจำนวนตามเงินที่มี (ทุนไม่พอซื้อเท่าที่ความเสี่ยงอนุญาต)',
      enterEntryFirst: 'กรอกราคาเข้าซื้อ (หรือราคาตอนนี้) ก่อน',
      calcHeadline: 'ควรซื้อได้ประมาณ <b>{shares} หุ้น</b> ใช้เงิน ≈ <b>{cost}</b>{fx}',
      kvRiskIfWrong: 'ถ้าผิดทาง (แตะ Stop) เสียไม่เกิน', kvStopPrice: 'ราคาตัดขาดทุน (Stop)', kvBreakeven: 'ราคาคุ้มทุน (รวมค่าคอมฯ ไป-กลับ)', kvRR: 'ความคุ้ม (กำไรคาดหวัง : ความเสี่ยง) ถึงแนวต้าน',
      tpLot1: 'ทยอยขายไม้ 1: {price}', tpLot2: 'ไม้ 2: {price}', tpLot3: 'ไม้ 3: {price}', thisStockFallback: 'หุ้น',
      aiSumTitle: 'สรุปหุ้นด้วย AI', aiSumBtn: 'สรุปให้หน่อย',
      iosNotSupported: 'ฟีเจอร์นี้ (AI รันในเครื่อง) ยังไม่รองรับ iPhone/iPad ตอนนี้ — หน่วยความจำต่อแท็บของ Safari/iOS จำกัดเกินกว่าจะรันโมเดลได้อย่างเสถียร ลองใช้งานจากคอมพิวเตอร์แทนได้ครับ',
      needStockData: 'ยังไม่มีข้อมูลหุ้นให้สรุป — ดึงราคาหรือดูกราฟตัวอย่างก่อนนะครับ',
      summarizing: 'กำลังสรุป… (ครั้งแรกอาจต้องโหลดโมเดล AI ~350MB ก่อน)', loadingModel: 'กำลังโหลดโมเดล (ครั้งแรกเท่านั้น) {file} {pct}',
      summarizeFail: 'สรุปไม่สำเร็จ ลองอีกครั้ง', summarizeFailWith: 'สรุปไม่สำเร็จ: {msg}', unknownReason: 'ไม่ทราบสาเหตุ',
      memErrorMsg: 'โหลดโมเดล AI ไม่สำเร็จ เพราะหน่วยความจำที่เบราว์เซอร์เหลือให้ใช้ไม่พอ (มักเกิดถ้าเปิดแท็บ/โปรแกรมอื่นพร้อมกันเยอะ) ลองปิดแท็บ/โปรแกรมอื่นแล้วกดสรุปใหม่อีกครั้ง',
      diskErrorMsg: 'บันทึกไฟล์โมเดล AI ไม่สำเร็จ เพราะพื้นที่จัดเก็บของเบราว์เซอร์สำหรับเว็บไซต์นี้เต็ม (คนละเรื่องกับโปรแกรม/แท็บอื่นที่เปิดอยู่) ลองล้างข้อมูลเว็บไซต์นี้ในเบราว์เซอร์ หรือเพิ่มพื้นที่ว่างในดิสก์แล้วลองใหม่',
      summarizeCached: 'ผลสรุปนี้มีคนคำนวณไว้แล้ววันนี้ (โหลดจากแคช ไม่ต้องรันโมเดลในเครื่อง)',
      ctxStock: 'หุ้น: {v}', ctxLatestPrice: 'ราคาล่าสุด: {v} ดอลลาร์สหรัฐฯ', ctxVerdict: 'สัญญาณไฟจราจรที่คำนวณแล้ว: {v} ({why})',
      ctxPros: 'ปัจจัยหนุนที่ตรวจพบ: {v}', ctxCons: 'ปัจจัยเสี่ยงที่ตรวจพบ: {v}',
      ctxRsi: 'RSI (14 วัน): {v}', ctxRsiHigh: ' (สูง/ร้อนแรง)', ctxRsiLow: ' (ต่ำ/แรงขายเริ่มคลาย)', ctxRsiMid: ' (กลางๆ)',
      ctxMacd: 'MACD histogram: {v}', ctxMacdPos: ' (เป็นบวก)', ctxMacdNeg: ' (เป็นลบ)',
      ctxEma: 'เส้นเฉลี่ย 20 วัน: {e20}, เส้นเฉลี่ย 50 วัน: {e50}', ctxEmaUp: ' (ราคาอยู่เหนือเส้นเฉลี่ย — แนวโน้มขึ้น)', ctxEmaDn: ' (ราคาอยู่ใต้เส้นเฉลี่ย — แนวโน้มลง/พักตัว)',
      ctxSupport: 'แนวรับล่าสุด: {v}', ctxResistance: 'แนวต้านล่าสุด: {v}',
      ctxAdx: 'ความแรงแนวโน้ม (ADX): {v}', ctxAdxStrong: ' (แข็งแรง)', ctxAdxWeak: ' (อ่อน)',
      alertJournalFields: 'กรอกราคาเข้า ราคาออก และจำนวนหุ้นให้ครบ', alertEnterSym: 'ใส่ชื่อหุ้นก่อน', alertEnterValid: 'กรอกจำนวนหุ้นและราคาต้นทุนให้ถูกต้อง',
      fetchingSellPrice: 'กำลังดึงราคา {sym}…', sellFetchFail: 'ดึงราคา {sym} ไม่ได้ตอนนี้ — ลองใหม่อีกครั้ง หรือกรอกราคาปัจจุบันเองในช่อง',
      sellLatestPrice: 'ราคาล่าสุด {price}', sellSavedAge: ' (บันทึกไว้ {age})', sellCostLabel: ' · ต้นทุน {cost} · ', sellProfit: 'กำไร ', sellLoss: 'ขาดทุน ',
      chkTrendUp: 'อยู่ในแนวโน้มขึ้น (ราคาเหนือเส้นเฉลี่ย)', chkTrendDn: 'ยังไม่อยู่ในแนวโน้มขึ้น (ราคาใต้เส้นเฉลี่ย)',
      chkAdxStrong: ' · ADX {adx} เทรนด์แข็งแรง', chkAdxWeak: ' · ADX {adx} เทรนด์อ่อน ควรระวัง',
      chkNoChase: 'ไม่ไล่ราคา (ห่างเส้นเฉลี่ย 20 ไม่เกิน 5%)', chkChasing: 'กำลังไล่ราคา (สูงกว่าเส้นเฉลี่ย 20 เกิน 5%)',
      chkTrendUnknown: 'แนวโน้ม/การไล่ราคา: ต้องมีข้อมูลกราฟก่อน (กด "ดึงราคา" หรือ "ดูกราฟตัวอย่าง")',
      chkRsiOk: 'ไม่ร้อนแรงเกิน (RSI {rsi})', chkRsiHot: 'ร้อนแรงเกินไป (RSI {rsi} ≥ 70) เสี่ยงย่อ', chkRsiUnknown: 'RSI: ต้องมีข้อมูลกราฟก่อน',
      chkStopSet: 'ตั้งจุดตัดขาดทุน (Stop) แล้ว', chkStopUnset: 'ยังไม่ตั้งจุดตัดขาดทุน — กด "คำนวณ" ในขั้นที่ 2 ก่อน',
      chkRiskOk: 'เสี่ยงต่อไม้ ≤ 2% ({riskPct}%)', chkRiskHigh: 'เสี่ยงต่อไม้สูงไป ({riskPct}) — ควร ≤ 2%',
      chkRrOk: 'กำไรคาดหวัง:เสี่ยง ≥ 2:1 ({rr}:1)', chkRrLow: 'กำไร:เสี่ยงน้อยไป ({rr}:1) — ควร ≥ 2:1', chkRrUnknown: 'กำไร:เสี่ยง: ต้องมีแนวต้านจากกราฟ + ตั้ง Stop ก่อน',
      checklistFail: 'ยังไม่ควรเข้า — ติด {n} ข้อ ควรแก้ให้ครบก่อนซื้อ', checklistUnknown: 'ข้อมูลไม่พอประเมินครบ — กด "ประเมิน"/"ดึงราคา" แล้ว "คำนวณ" ก่อน',
      checklistGo: 'เข้าได้ตามแผน — ผ่านครบทุกข้อ (แต่ยังไม่การันตีกำไร ทำตามแผนและตัดขาดทุนเสมอ)',
      expInvalid: 'กรอกตัวเลขให้ครบ (อัตราชนะ 0–100%, กำไร/ขาดทุนเป็นเท่าของ R)',
      expMsg: 'ค่าคาดหวังต่อไม้ ≈ <b>{sign}{exp} R</b> (ถ้าเสี่ยงไม้ละ $1,000 ≈ {sign2}{amt} ต่อไม้โดยเฉลี่ย)<br><span style="font-weight:500">ต้องชนะอย่างน้อย ~{be}% ถึงจะเสมอตัวที่ R นี้</span>',
      expGoodPrefix: 'ได้เปรียบระยะยาว<br>', expGoodSuffix: '<br><span style="font-weight:500">ถ้าทำตามวินัยสม่ำเสมอ (คุมความเสี่ยงเท่ากันทุกไม้) มีโอกาสกำไรระยะยาว</span>',
      expBreakevenPrefix: 'แทบเสมอตัว<br>', expBreakevenSuffix: '<br><span style="font-weight:500">หักค่าคอมฯแล้วอาจขาดทุน — ต้องเพิ่มกำไรตอนชนะ หรือลดขาดทุนตอนแพ้</span>',
      expBadPrefix: 'ขาดทุนระยะยาว<br>', expBadSuffix: '<br><span style="font-weight:500">ถึงชนะบ่อยก็ไม่พอ — ต้อง "ปล่อยกำไรให้ยาว ตัดขาดทุนให้ไว" (เพิ่ม R ตอนชนะ)</span>',
      scanIdle: 'หาหุ้นน่าสนใจ', scanDone: 'สแกนสำเร็จ {ok}/{total} ตัว · เจอน่าสนใจ {green} ตัว (ไม่ใช่คำแนะนำซื้อ)', scanProgress: 'กำลังสแกน {idx}/{total} ({sym})…',
      sellSarDn: 'พิจารณาขาย — สัญญาณเทรนด์กลับตัว (SAR พลิกลง)', sellBelowTrend: 'พิจารณาขาย/ตัดขาดทุน — ราคาหลุดแนวโน้ม (ต่ำกว่าเส้นค่าเฉลี่ย)',
      sellHotRsi: 'พิจารณาล็อกกำไรบางส่วน — RSI สูง ราคาร้อนแรง อาจย่อ', sellNearResist: 'ใกล้แนวต้าน — พิจารณาล็อกกำไรบางส่วน',
      sellHold: 'ยังอยู่ในแนวโน้มขึ้น — ถือต่อได้ เลื่อนจุดตัดขาดทุนตามแนวด้านล่าง',
      sarLabel: 'แนวตัดขาดทุนตามเทรนด์ (SAR)', sarNoData: 'ข้อมูลไม่พอคำนวณ (ต้องมีประวัติราคาอย่างน้อย ~3 วัน)',
      sarUpReason: 'ถ้าราคาปิดหลุดต่ำกว่า {sar} ถือว่าเทรนด์ขาขึ้นเริ่มกลับตัว', sarDnReason: 'ราคาหลุดแนวนี้ไปแล้ว (SAR พลิกลง) — เป็นสัญญาณเตือนที่ชัดที่สุด',
      stopRiskLabel: 'จุดตัดขาดทุนตามความเสี่ยง (ATR/แนวรับ)', noData: 'ข้อมูลไม่พอคำนวณ',
      stopRiskReason: 'กันขาดทุนหนักถ้าราคาหลุดแนวรับหรือผันผวนเกินค่าเฉลี่ย{atr}', atrSuffix: ' (ATR ≈ {atr})',
      ema20Label: 'เส้นค่าเฉลี่ย 20 วัน (สัญญาณเตือนแรก)', ema20Reason: 'หลุดเส้นนี้มักเป็นสัญญาณเริ่มอ่อนตัว — ยังไม่ใช่จุดตัดขาดทุนหลัก แต่ควรเริ่มระวัง',
      resistLabel: 'แนวต้าน (จุดพิจารณาล็อกกำไรบางส่วน)', resistReason: 'ราคามักเจอแรงขายทำกำไรบริเวณนี้ พิจารณาขายบางส่วนหรือเลื่อนจุดตัดขาดทุนตามเพื่อป้องกันกำไร',
      noCompanyInfo: 'ไม่มีข้อมูลบริษัทในฐานข้อมูล', companyInfoFallback: 'รองรับเฉพาะหุ้นในรายการที่มีข้อมูล — <a href="{url}" target="_blank" rel="noopener">ค้นหาข้อมูลบริษัท {sym} เอง ↗</a>',
      searchNewsMyself: 'ค้นหาข่าวเอง ↗', searchingNews: 'กำลังค้นข่าว {sym}… ', moreNews: 'ดูข่าวเพิ่มเติม ', newsAutoFail: 'ดึงข่าวอัตโนมัติไม่ได้ตอนนี้ ',
      driveSyncing: 'กำลังซิงก์…', driveSyncedAt: 'ซิงก์กับ Google Drive แล้ว · {t}', driveLastSync: 'ซิงก์ล่าสุด {t}',
      driveErrSearchFolder: 'ค้นหาโฟลเดอร์ไม่สำเร็จ ({status})', driveErrCreateFolder: 'สร้างโฟลเดอร์ไม่สำเร็จ ({status})',
      driveErrSearchFile: 'ค้นหาไฟล์ไม่สำเร็จ ({status})', driveErrDownload: 'ดาวน์โหลดไม่สำเร็จ ({status})', driveErrUpload: 'บันทึกขึ้น Drive ไม่สำเร็จ ({status})',
      driveSyncFailed: 'ซิงก์ไม่สำเร็จ: {msg}', driveSessionExpired: 'เซสชันหมดอายุ — กดปุ่มเชื่อมต่อ Drive อีกครั้ง',
      driveConnectFailedAuto: 'เชื่อมต่ออัตโนมัติไม่สำเร็จ (อาจเพราะเบราว์เซอร์บล็อก cookie ข้ามโดเมน) — กดปุ่มเชื่อมต่ออีกครั้ง',
      driveConnectFailed: 'เชื่อมต่อไม่สำเร็จ: {err}', driveLoadingGis: 'กำลังโหลด Google Identity Services… รออีก 2-3 วิแล้วลองใหม่', driveRequesting: 'กำลังขอสิทธิ์เชื่อมต่อ…',
      fxFetching: 'กำลังดึงอัตราแลกเปลี่ยน…', fxFromYahoo: 'อัตราจาก Yahoo Finance (THB=X) · เมื่อสักครู่',
      fxUsingSaved: 'ดึงสดไม่ได้ — ใช้อัตราที่บันทึกไว้ ({age})', fxAutoFail: 'ดึงอัตโนมัติไม่ได้ตอนนี้ — กรอกอัตราแลกเปลี่ยนเองด้านบน',
      perShareAtRate: '≈ {v} ต่อหุ้น (ตามอัตราที่ตั้งไว้)'
    },
    en: {
      crumbHome: 'Investing', crumbHere: 'Global Stocks',
      pageTitle: 'Global Stocks — Entry/Exit Helper',
      step1Title: 'Current stock price', symLabel: 'Ticker (e.g. AAPL, MSFT)', fetchBtn: 'Try fetching price',
      priceNowLabel: 'Current price (USD)', priceNowPh: 'e.g. 180.50', priceHiLabel: 'Period high', priceLoLabel: 'Period low', periodPh: '3-month range',
      liveModeHistorical: 'Data mode: Historical', liveMetaDefault: 'Set up a live data source in "Market Data Settings"',
      refreshBtn: '↻ Refresh', marketSettingsBtn: '⚙️ Market Data Settings',
      marketSettingsTitle: 'Live Market Data', providerLabel: 'Data source', providerGateway: 'Tanot Data Gateway (recommended)', providerYahoo: 'Yahoo / Historical',
      gatewayUrlLabel: 'Gateway URL', apiKeyLabel: 'Twelve Data API Key', apiKeyNote: '(stored locally only)', apiKeyPh: 'Enter if you have an API key',
      intervalLabel: 'Refresh every', interval5: '5 seconds', interval10: '10 seconds', interval30: '30 seconds',
      saveSettingsBtn: 'Save settings', clearApiKeyBtn: 'Clear API Key',
      analyzeBtn: 'Analyze it for me', demoBtn: 'View sample chart (practice)',
      pasteSummary: 'Paste historical prices yourself (optional)', pasteHint: 'Paste several days of closing prices, separated by spaces/lines/commas (oldest→newest)', pasteBtn: 'Use this price',
      fxSummary: 'Convert to Thai baht (optional)', fxDesc: 'Turn on to see an ≈ baht amount alongside the USD figures on this page (optional, never affects the core calculations, which stay in USD)',
      fxRateLabel: 'Exchange rate', fxRatePh: 'e.g. 36.00', unitBahtPerUsd: '(baht per 1 USD)', fxFetchBtn: 'Fetch current rate', fxShowLabel: 'Show baht-equivalent amounts (≈ ฿) on this page',
      ulTitle: 'Popular US stocks', scanBtn: 'Find interesting stocks', scanBtnStop: '⏹ Stop', greenOnlyLabel: 'Green only',
      ulThSym: 'Ticker', ulThLast: 'Last', ulThChg: '+/−', ulThPct: '%', ulThSig: 'Signal', ulRowLoading: 'Click to view',
      techDetailsSummary: 'View technical details (no need to understand it)', chartTitle: 'Price chart',
      tf1m: '1mo', tf3m: '3mo', tf6m: '6mo', tf1y: '1yr',
      tgMa20: 'MA 20', tgMa50: 'MA 50', tgVol: 'Volume', tgRsi: 'RSI',
      capUp: 'Up bar', capDn: 'Down bar', capMa20: '20-day MA', capMa50: '50-day MA', capTouch: 'Tap the chart to see each day\'s price',
      step2Title: 'If buying, how much to put in and where to sell', capitalLabel: 'Total portfolio capital (USD)', capitalPh: 'e.g. 10000',
      riskPctLabel: 'Risk per trade', unitPctPortfolio: '(% of portfolio)', entryLabel: 'Entry price (USD)', entryPh: '= current price',
      stopLabel: 'Stop-loss price', stopPh: 'Auto-suggested', commLabel: 'Commission', unitPctPerTrade: '(% per trade)',
      calcBtn: 'Calculate', saveToPortfolioBtn: 'Save to Portfolio', savedBtn: 'Saved',
      checklistTitle: 'Pre-Trade Checklist — Should You Buy?', checklistDesc: 'Check 6 discipline items before buying for real (stops emotional/chase buying) — click "Analyze" and "Calculate" above first, then click this button', checkBtn: 'Run Checklist',
      driveTitle: 'Back up Portfolio + Trade Journal to Google Drive',
      driveConnectBtn: 'Connect Google Drive', driveConnectedBtn: 'Google Drive connected',
      pfTitle: 'My Portfolio',
      pfSymLabel: 'Ticker', pfSharesLabel: 'Shares', pfCostLabel: 'Cost/share', pfAddBtn: '+ Add to Portfolio',
      pfEmptyDefault: 'No holdings yet',
      pfThSym: 'Stock', pfThShares: 'Shares', pfThCost: 'Cost/share', pfThCur: 'Current price', pfThPl: 'P/L',
      pfPricePh: 'Price', pfSellTitle: 'Check should I sell?', pfSellBtn: 'Should I sell?', pfDelTitle: 'Delete',
      journalTitle: 'Trade Journal + Stats (see your own "track record")',
      jSymLabel: 'Ticker', jEntryLabel: 'Entry price', jExitLabel: 'Exit price', jSharesLabel: 'Shares', jAddBtn: '+ Save',
      jStatCount: 'Trades', jStatWinRate: 'Win rate', jStatTotalPl: 'Total P/L', jStatExpectancy: 'Expectancy/trade',
      jThSym: 'Stock', jThEntry: 'Entry', jThExit: 'Exit', jThShares: 'Shares', jThResult: 'Result',
      jEmptyDefault: 'No trades logged yet — log every closed trade to see your real stats', jSymFallback: 'Stock',
      expectancyTitle: 'Is your trading system profitable long-term?',
      eWinLabel: 'Win rate', unitPctWinTrades: '(% of winning trades)', eWinRLabel: 'Average gain when winning', unitR: '(multiple of risk R)', eLossRLabel: 'Average loss when losing', unitR2: '(R)',
      realityTitle: 'Read before you put real money in (important)',
      reality1: 'Invest in stocks <b>only with money you won\'t need for at least 3–5 years</b> — money you can afford to lose without it affecting your life',
      reality2: 'Have <b>3–6 months of emergency savings</b> before you start, always',
      reality3: '<b>Absolutely never</b>: use money for food, rent, loan payments, or anything you need soon, to trade',
      reality4: 'Stock trading <b>is not a stable/fast side income</b> — most beginners lose money in the first year, especially when trading with money they need',
      reality5: 'Foreign stocks carry an extra layer of <b>exchange-rate risk</b> — even if a stock gains in USD, if the baht strengthens a lot, the profit converted back to baht can shrink',
      realityCta: 'If money is tight right now and you want low-risk growth, a much safer approach than picking individual stocks is <b>dollar-cost averaging into an index fund (DCA)</b> — <a href="invest-global-fund.html">try the S&amp;P 500 fund planner →</a>',
      ageJustNow: 'just now', ageMinsAgo: '{n} min ago', ageHrsAgo: '{n} hr ago', ageDaysAgo: '{n} days ago',
      liveModePrefix: 'Data mode: ', liveHistoricalLabel: 'Historical', liveHistoricalMeta: 'Using Yahoo for historical charts',
      liveLiveLabel: 'Live / Real-time', liveFallbackLabel: 'Fallback / Historical', liveFallbackMeta: "Can't connect to the live source right now · falling back to historical prices",
      liveQuoteMeta: '{source} · {ch}{pct} · updated {tm}', liveQuoteStatus: 'Latest price {price} USD · {source} · {tm}',
      enterPriceFirst: 'Please enter at least the "current price" first', gapNeedInfo: 'Enter the period high/low to assess cheap vs. expensive',
      gapNeedInfoWhy: 'Or click "View sample chart (practice)" to try the chart — for now only the money calculator below is available',
      chartLibFail: "Couldn't load the chart library (try going online then refreshing) — the signal light/money calculator still work",
      typeSymFirst: 'Type a ticker first, e.g. AAPL', fetchingData: 'Fetching {sym} data…',
      liveFromMsg: 'Live {sym} price from {source} · {days}-day historical chart',
      staleDataMsg: "Live source unavailable · using saved historical data ({age}) · {days} days",
      histFromMsg: 'Currently using historical prices from {source} · {days} days',
      notFoundMsg: "No data found for {sym} — check the ticker or your market data connection",
      demoMsg: 'Showing "sample data" (not a real price) — for trying the chart and practicing reading it',
      pasteAtLeast5: 'Please paste at least 5 days of closing prices', pastedMsg: 'Using pasted prices ({days} days)',
      settingsSaved: 'Settings saved · the system will fetch data at the interval you set', apiKeyCleared: 'API Key cleared from this device',
      demoBadge: 'Sample data — not real prices (for practicing reading charts)', pastedBadge: 'Self-pasted prices · {days} days',
      realBadge: '{label} · {status} · {days} days', realBadgeLabel: 'Real price', staleLatestPrice: 'Latest price {age}',
      legendOpen: 'Open {v}', legendHigh: 'High {v}', legendLow: 'Low {v}', legendClose: 'Close {v}',
      detEma20: '20-day MA (EMA20)', detEma50: '50-day MA (EMA50)', detRsi: 'RSI (14)', detMacd: 'MACD histogram',
      detBbUpper: 'Upper band (Bollinger)', detBbLower: 'Lower band (Bollinger)', detAtr: 'ATR (volatility)',
      detSupport: 'Latest support', detResistance: 'Latest resistance', detAdx: 'Trend strength (ADX 14)',
      detAdxStrong: ' · strong', detAdxWeak: ' · weak', detSar: 'Trailing stop (Parabolic SAR)', detSarUp: ' · uptrend', detSarDn: ' · downtrend', detNoData: '—',
      vInteresting: 'Interesting — worth considering', vCareful: 'Careful — not the right time yet', vWait: 'Wait — no standout opportunity yet',
      whyCheapRange: 'Price is in the cheap part of the 3-month range', whyExpensiveRange: 'Price is in the expensive part of the 3-month range',
      whyRsiLow: 'Selling pressure easing (RSI low, starting to recover)', whyRsiHigh: 'Price is overheated (RSI high, risk of a pullback)',
      whyMomUp: 'Momentum is turning positive', whyMomDn: 'Momentum is weakening',
      whyUptrend: 'Still in an uptrend', whyDowntrend: 'Below the trend line (downtrend/consolidation)',
      whyBbLow: 'Price is touching the lower band (often a bounce point)', whyBbHigh: 'Price is hitting the upper band', whyNeutral: 'Price is in the middle of the range, no clear signal yet',
      vExpensive: 'Careful — price is fairly expensive', vMid: 'Wait — price is mid-range',
      whyCheapPct: 'Price is toward the cheap end of the range (~{pct}% of low→high)', whyExpensivePct: 'Price is toward the expensive end of the range (~{pct}% of low→high)', whyMidPct: 'Price is in the middle of the range (~{pct}% of low→high)',
      stopMustBeLower: 'The stop-loss price must be lower than the entry price', minShareNote: 'Minimum 1 share, which makes the risk slightly exceed the {riskPct}% you set — consider tightening the stop, or adding capital',
      capitalLimitNote: 'Limited by available funds (not enough capital to buy as much as the risk setting allows)',
      enterEntryFirst: 'Enter the entry price (or current price) first',
      calcHeadline: 'You should buy about <b>{shares} shares</b>, using ≈ <b>{cost}</b>{fx}',
      kvRiskIfWrong: "If wrong (hits Stop), you lose no more than", kvStopPrice: 'Stop-loss price', kvBreakeven: 'Break-even price (incl. round-trip commission)', kvRR: 'Reward:risk to resistance',
      tpLot1: 'Sell lot 1: {price}', tpLot2: 'Lot 2: {price}', tpLot3: 'Lot 3: {price}', thisStockFallback: 'stock',
      aiSumTitle: 'AI Stock Summary', aiSumBtn: 'Summarize It',
      iosNotSupported: 'This feature (on-device AI) isn’t supported on iPhone/iPad yet — Safari/iOS per-tab memory is too limited to run the model reliably. Try from a computer instead',
      needStockData: 'No stock data to summarize yet — fetch a price or view the sample chart first',
      summarizing: 'Summarizing… (first time may need to download the ~350MB AI model)', loadingModel: 'Loading model (first time only) {file} {pct}',
      summarizeFail: 'Summary failed, try again', summarizeFailWith: 'Summary failed: {msg}', unknownReason: 'unknown reason',
      memErrorMsg: 'Failed to load the AI model because the browser doesn’t have enough free memory (usually from having many tabs/programs open at once). Try closing other tabs/programs and summarizing again',
      diskErrorMsg: 'Failed to save the AI model file because this site’s browser storage is full (unrelated to other open tabs/programs). Try clearing this site’s data in your browser, or free up disk space, then try again',
      summarizeCached: 'Someone already summarized this today (loaded from cache — no local model run needed)',
      ctxStock: 'Stock: {v}', ctxLatestPrice: 'Latest price: {v} USD', ctxVerdict: 'Computed signal: {v} ({why})',
      ctxPros: 'Detected tailwinds: {v}', ctxCons: 'Detected risks: {v}',
      ctxRsi: 'RSI (14-day): {v}', ctxRsiHigh: ' (high/overheated)', ctxRsiLow: ' (low/selling pressure easing)', ctxRsiMid: ' (neutral)',
      ctxMacd: 'MACD histogram: {v}', ctxMacdPos: ' (positive)', ctxMacdNeg: ' (negative)',
      ctxEma: '20-day MA: {e20}, 50-day MA: {e50}', ctxEmaUp: ' (price above the MAs — uptrend)', ctxEmaDn: ' (price below the MAs — downtrend/consolidation)',
      ctxSupport: 'Latest support: {v}', ctxResistance: 'Latest resistance: {v}',
      ctxAdx: 'Trend strength (ADX): {v}', ctxAdxStrong: ' (strong)', ctxAdxWeak: ' (weak)',
      alertJournalFields: 'Please fill in entry price, exit price, and share count', alertEnterSym: 'Enter a ticker first', alertEnterValid: 'Enter a valid share count and cost',
      fetchingSellPrice: 'Fetching {sym} price…', sellFetchFail: "Couldn't fetch {sym} price right now — try again, or enter the current price yourself",
      sellLatestPrice: 'Latest price {price}', sellSavedAge: ' (saved {age})', sellCostLabel: ' · cost {cost} · ', sellProfit: 'profit ', sellLoss: 'loss ',
      chkTrendUp: 'In an uptrend (price above the moving averages)', chkTrendDn: 'Not yet in an uptrend (price below the moving averages)',
      chkAdxStrong: ' · ADX {adx} strong trend', chkAdxWeak: ' · ADX {adx} weak trend, be careful',
      chkNoChase: 'Not chasing the price (within 5% of the 20-day MA)', chkChasing: 'Chasing the price (more than 5% above the 20-day MA)',
      chkTrendUnknown: 'Trend/chase check: needs chart data first (click "Fetch Price" or "View Sample Chart")',
      chkRsiOk: 'Not overheated (RSI {rsi})', chkRsiHot: 'Overheated (RSI {rsi} ≥ 70), risk of pullback', chkRsiUnknown: 'RSI: needs chart data first',
      chkStopSet: 'Stop-loss is set', chkStopUnset: 'Stop-loss not set yet — click "Calculate" in step 2 first',
      chkRiskOk: 'Risk per trade ≤ 2% ({riskPct}%)', chkRiskHigh: 'Risk per trade too high ({riskPct}) — should be ≤ 2%',
      chkRrOk: 'Reward:risk ≥ 2:1 ({rr}:1)', chkRrLow: 'Reward:risk too low ({rr}:1) — should be ≥ 2:1', chkRrUnknown: 'Reward:risk: needs resistance from the chart + a stop set first',
      checklistFail: 'Not ready to enter — {n} item(s) failed, fix them all before buying', checklistUnknown: 'Not enough data to fully assess — click "Analyze"/"Fetch Price" then "Calculate" first',
      checklistGo: "Ready to enter per plan — all items passed (still no profit guarantee — follow the plan and always cut losses)",
      expInvalid: 'Fill in all the numbers (win rate 0–100%, gain/loss as a multiple of R)',
      expMsg: 'Expected value per trade ≈ <b>{sign}{exp} R</b> (if risking $1,000 per trade ≈ {sign2}{amt} per trade on average)<br><span style="font-weight:500">You need to win at least ~{be}% to break even at this R</span>',
      expGoodPrefix: 'Profitable long-term<br>', expGoodSuffix: '<br><span style="font-weight:500">If you follow this discipline consistently (same risk every trade), you have a real shot at long-term profit</span>',
      expBreakevenPrefix: 'Nearly break-even<br>', expBreakevenSuffix: '<br><span style="font-weight:500">After commissions this may lose money — you need bigger wins or smaller losses</span>',
      expBadPrefix: 'Losing long-term<br>', expBadSuffix: '<br><span style="font-weight:500">Winning often isn\'t enough — you need to "let winners run, cut losers fast" (increase R when winning)</span>',
      scanIdle: 'Find interesting stocks', scanDone: 'Scanned {ok}/{total} · found {green} interesting (not a buy recommendation)', scanProgress: 'Scanning {idx}/{total} ({sym})…',
      sellSarDn: 'Consider selling — trend reversal signal (SAR flipped down)', sellBelowTrend: 'Consider selling/cutting losses — price broke the trend (below the moving averages)',
      sellHotRsi: 'Consider locking in some profit — RSI high, price overheated, may pull back', sellNearResist: 'Near resistance — consider locking in some profit',
      sellHold: 'Still in an uptrend — can keep holding, trail your stop-loss along the levels below',
      sarLabel: 'Trend-following stop (SAR)', sarNoData: 'Not enough data to calculate (needs at least ~3 days of price history)',
      sarUpReason: 'If the closing price falls below {sar}, the uptrend is considered to be reversing', sarDnReason: 'Price has already broken this level (SAR flipped down) — the clearest warning signal',
      stopRiskLabel: 'Risk-based stop-loss (ATR/support)', noData: 'Not enough data to calculate',
      stopRiskReason: 'Protects against a large loss if price breaks support or moves more than average{atr}', atrSuffix: ' (ATR ≈ {atr})',
      ema20Label: '20-day MA (first warning signal)', ema20Reason: "Breaking below this line is often an early weakening signal — not the main stop-loss, but time to be more careful",
      resistLabel: 'Resistance (point to consider locking in some profit)', resistReason: 'Price often meets profit-taking selling around here — consider selling part of the position or trailing your stop to protect the gain',
      noCompanyInfo: 'No company info in the database', companyInfoFallback: 'Only stocks in the reference list are supported — <a href="{url}" target="_blank" rel="noopener">search for {sym} company info yourself ↗</a>',
      searchNewsMyself: 'Search news myself ↗', searchingNews: 'Searching news for {sym}… ', moreNews: 'More news ', newsAutoFail: "Couldn't auto-fetch news right now ",
      driveSyncing: 'Syncing…', driveSyncedAt: 'Synced with Google Drive · {t}', driveLastSync: 'Last synced {t}',
      driveErrSearchFolder: 'Folder search failed ({status})', driveErrCreateFolder: 'Folder creation failed ({status})',
      driveErrSearchFile: 'File search failed ({status})', driveErrDownload: 'Download failed ({status})', driveErrUpload: 'Saving to Drive failed ({status})',
      driveSyncFailed: 'Sync failed: {msg}', driveSessionExpired: 'Session expired — click Connect Drive again',
      driveConnectFailedAuto: "Automatic reconnect failed (possibly because the browser blocks cross-domain cookies) — click Connect again",
      driveConnectFailed: 'Connect failed: {err}', driveLoadingGis: 'Loading Google Identity Services… wait a couple of seconds and try again', driveRequesting: 'Requesting connection permission…',
      fxFetching: 'Fetching exchange rate…', fxFromYahoo: 'Rate from Yahoo Finance (THB=X) · just now',
      fxUsingSaved: 'Live fetch failed — using saved rate ({age})', fxAutoFail: "Couldn't auto-fetch right now — enter the exchange rate yourself above",
      perShareAtRate: '≈ {v} per share (at the rate you set)'
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
    else { light = 'yellow'; verdict = t('vWait'); }
    var why = (light === 'green' ? pros : light === 'red' ? cons : (pros.concat(cons)))[0] || t('whyNeutral');

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
    if (pos < 0.35) { light = 'green'; verdict = t('vInteresting'); why = t('whyCheapPct', { pct: pct }); }
    else if (pos > 0.75) { light = 'red'; verdict = t('vExpensive'); why = t('whyExpensivePct', { pct: pct }); }
    else { light = 'yellow'; verdict = t('vMid'); why = t('whyMidPct', { pct: pct }); }
    return { light: light, verdict: verdict, why: why, pros: [], cons: [], price: price, suggestStop: Math.min(lo, price * 0.95), resistance: hi, det: { posRange: pos, support: lo, resistance: hi }, simple: true };
  }

  /* ── คุมเงิน/ความเสี่ยง (USD, ซื้อเป็นหุ้นเดี่ยวได้ ไม่ต้องเป็นล็อต) ──────── */
  function riskCalc(o) {
    var capital = o.capital, riskPct = o.riskPct, entry = o.entry, stop = o.stop, comm = o.comm / 100;
    var perShare = entry - stop;
    if (!(perShare > 0)) return { error: t('stopMustBeLower') };
    var riskBudget = capital * riskPct / 100;
    var shares = Math.floor(riskBudget / perShare), note = '';
    if (shares < 1) { shares = 1; note = t('minShareNote', { riskPct: riskPct }); }
    var cost = shares * entry;
    if (cost > capital) {
      var maxShares = Math.floor(capital / entry);
      if (maxShares >= 1) { shares = maxShares; cost = shares * entry; note = t('capitalLimitNote'); }
    }
    var R = perShare, breakeven = entry * (1 + comm) / (1 - comm);
    var rr = isFinite(o.resistance) && o.resistance > entry ? (o.resistance - entry) / R : NaN;
    return { shares: shares, cost: cost, riskUsd: shares * perShare, tp1: entry + R, tp2: entry + 2 * R, tp3: entry + 3 * R, breakeven: breakeven, rr: rr, riskBudget: riskBudget, note: note };
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
    var price = 180, i;
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

  /* ── ดึงราคา Yahoo (หุ้น US ไม่มี suffix ตลาด) หลายเส้นทาง best-effort ── */
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
      { name: 'own', url: 'https://tanot-cors-proxy.tanot713.workers.dev/?url=' + enc },
      { name: 'allorigins', url: 'https://api.allorigins.win/raw?url=' + enc },
      { name: 'codetabs', url: 'https://api.codetabs.com/v1/proxy/?quest=' + enc },
      { name: 'corseu', url: 'https://cors.eu.org/' + base },
      { name: 'corsworkers', url: 'https://test.cors.workers.dev/?' + base },
      { name: 'corslol', url: 'https://api.cors.lol/?url=' + enc },
      { name: 'ตรง', url: base }
    ];
    var i = 0, best = null;
    /* ไล่ทุกเส้นทาง เลือกอันที่ได้ "จำนวนวันมากสุด" — กัน proxy ที่คืนข้อมูลสั้น (เช่น 10 วัน);
       พอได้ ≥60 วันก็หยุด (ถือว่าพอดูแนวโน้ม) */
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
  /* namespace 'us:' กันชนกับ cache ของหน้าหุ้นไทย แม้ชื่อย่อจะบังเอิญตรงกัน */
  function cacheKey(sym) { return 'tanot:invest:cache:us:' + sym; }
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
  /* ดึงสด → cache; ถ้าพลาดแต่มี cache → คืน cache (stale) เพื่อไม่ให้ error */
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

  /* ══════ อัตราแลกเปลี่ยน USD→บาท (ทางเลือก, best-effort) ══════ */
  var fxRate = NaN;
  function fxCacheKey() { return 'tanot:invest:fxcache'; }
  function saveFxCache(rate) { try { localStorage.setItem(fxCacheKey(), JSON.stringify({ ts: Date.now(), rate: rate })); } catch (e) {} }
  function loadFxCache() { try { var o = JSON.parse(localStorage.getItem(fxCacheKey())); return (o && isFinite(o.rate)) ? o : null; } catch (e) { return null; } }
  function parseFxRate(t) {
    var j = JSON.parse(t), res = j && j.chart && j.chart.result && j.chart.result[0];
    var meta = res && res.meta, q = res && res.indicators && res.indicators.quote && res.indicators.quote[0];
    var rate = meta && isFinite(meta.regularMarketPrice) ? meta.regularMarketPrice : null;
    if (!rate && q && q.close) { for (var i = q.close.length - 1; i >= 0; i--) { if (q.close[i] != null) { rate = q.close[i]; break; } } }
    if (!isFinite(rate) || rate <= 0) throw new Error('no rate');
    return rate;
  }
  function fetchFxRate() {
    var base = 'https://query1.finance.yahoo.com/v8/finance/chart/THB=X?range=5d&interval=1d';
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
    var i = 0;
    function next() {
      if (i >= tries.length) return Promise.reject(new Error('all failed'));
      var t = tries[i++];
      return fetchOne(t.url, 7000, parseFxRate).catch(function () { return next(); });
    }
    return next();
  }
  function setFxStatus(msg, cls) { var el = $('fxStatus'); if (el) { el.textContent = msg; el.className = 'status' + (cls ? ' ' + cls : ''); } }
  function fxOn() { return !!($('fxShowChk') && $('fxShowChk').checked) && isFinite(fxRate) && fxRate > 0; }
  function fxSpan(n) { return (fxOn() && isFinite(n)) ? (' <span class="fx-sub">(≈ ' + baht(n * fxRate) + ')</span>') : ''; }
  function updatePriceFx() {
    var el = $('priceFx'); if (!el) return;
    var p = num($('price').value);
    el.textContent = (fxOn() && isFinite(p)) ? t('perShareAtRate', { v: baht(p * fxRate) }) : '';
  }
  function doFxFetch() {
    setFxStatus(t('fxFetching'));
    fetchFxRate().then(function (rate) {
      fxRate = rate; saveFxCache(rate);
      $('fxRate').value = rate.toFixed(2);
      setFxStatus(t('fxFromYahoo'), 'ok');
      updatePriceFx();
    }, function () {
      var c = loadFxCache();
      if (c) { fxRate = c.rate; $('fxRate').value = c.rate.toFixed(2); setFxStatus(t('fxUsingSaved', { age: cacheAgeText(c.ts) }), 'ok'); updatePriceFx(); }
      else setFxStatus(t('fxAutoFail'), 'err');
    });
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
      '<span>' + t('legendOpen', { v: fmt(o.open) }) + '</span><span>' + t('legendHigh', { v: fmt(o.high) }) + '</span><span>' + t('legendLow', { v: fmt(o.low) }) + '</span>' +
      '<span class="' + (up ? 'up' : 'dn') + '">' + t('legendClose', { v: fmt(o.close) }) + '</span>';
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
    /* บังคับปรับขนาด/วาดใหม่หลัง layout นิ่ง (กัน canvas กว้าง 0 บน iOS) */
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
    updatePriceFx();
    showAnalysis(analyzeSeries(s));
    if (!buildChart(s)) setStatus(t('chartLibFail'), 'err');
  }

  function showAnalysis(a) {
    lastAnalysis = a;
    $('lightCard').style.display = 'block';
    /* วาดวงกลมสีด้วย CSS แทน emoji 🟢🟡🔴 — บางอุปกรณ์/เบราว์เซอร์ไม่มีฟอนต์รองรับ
       emoji วงกลมสี (โดยเฉพาะ 🟢/🟡 ที่เพิ่งเข้า Unicode ทีหลัง) แสดงเป็นกล่องว่างแทน
       ซึ่งทำให้ไฟจราจร (จุดขายหลักของหน้านี้) สื่อความหมายไม่ได้เลย */
    var bulbColors = { green: 'var(--ok)', yellow: 'var(--amber)', red: 'var(--err)' };
    $('light').className = 'light ' + a.light;
    $('bulb').textContent = '';
    $('bulb').style.background = bulbColors[a.light] || '#B8C0D4';
    $('verdict').textContent = a.verdict;
    $('why').textContent = a.why;

    if (a.det && !a.simple && isFinite(a.det.rsi)) {
      var d = a.det, rows = [
        [t('detEma20'), fmt(d.ema20)], [t('detEma50'), fmt(d.ema50)],
        [t('detRsi'), fmt(d.rsi, 1)], [t('detMacd'), fmt(d.macdHist, 3)],
        [t('detBbUpper'), fmt(d.bbUpper)], [t('detBbLower'), fmt(d.bbLower)],
        [t('detAtr'), fmt(d.atr)], [t('detSupport'), fmt(d.support)], [t('detResistance'), fmt(d.resistance)],
        [t('detAdx'), isFinite(d.adx) ? fmt(d.adx, 0) + (d.adx >= 20 ? t('detAdxStrong') : t('detAdxWeak')) : t('detNoData')],
        [t('detSar'), d.psar ? fmt(d.psar.sar) + (d.psar.up ? t('detSarUp') : t('detSarDn')) : t('detNoData')]
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

  /* ══════ สรุปหุ้นด้วย AI — ใช้ ai-chat-worker.js ตัวเดียวกับวิดเจ็ตแชทลอย (ai-chat-widget.js)
     รันในเครื่องผู้ใช้เอง ไม่ส่งข้อมูลออกไปไหน แนวทาง "guided summarization" เดียวกับหน้าหุ้นไทย —
     ป้อน "ตัวเลข/สัญญาณที่หน้านี้คำนวณไว้ให้แล้ว" (RSI/MACD/แนวรับ-แนวต้าน ฯลฯ จาก analyzeSeries()
     ด้านบน) ตรงๆ ให้โมเดล กันโมเดลเล็กต้องมาคำนวณ/ตีความตัวเลขเอง ให้ทำหน้าที่แค่ "เรียบเรียงเป็นภาษาพูด"
     จากผลที่คำนวณแม่นแล้วเท่านั้น (หน้านี้ไม่มีข่าวรายหุ้นแบบหน้าหุ้นไทย จึงไม่มีส่วนข่าวในบริบทที่ป้อน) ── */
  var AI_SUMMARY_SYSTEM_PROMPT = 'คุณเป็นผู้ช่วยสรุปข้อมูลหุ้นให้นักลงทุนมือใหม่ชาวไทยฟัง จะได้รับตัวเลข/' +
    'สัญญาณทางเทคนิคที่คำนวณไว้ให้แล้วล่วงหน้า (ห้ามคำนวณหรือเดาตัวเลขเพิ่มเองเด็ดขาด ใช้เฉพาะตัวเลขที่ให้มา) ' +
    'หน้าที่ของคุณคือเรียบเรียงเป็นภาษาพูดที่เข้าใจง่าย ไม่ใช่ผู้แนะนำการลงทุน ' +
    'ตอบเป็นภาษาไทยตามโครงสร้างนี้เท่านั้น (ห้ามขึ้นต้นด้วยคำนำ ให้เริ่มที่ "สรุปภาพรวม:" ทันที):\n\n' +
    'สรุปภาพรวม: (1-2 ประโยค อธิบายสถานะราคาปัจจุบันแบบเข้าใจง่ายจากข้อมูลที่ให้)\n' +
    'ปัจจัยหนุน: (ไม่เกิน 3 ข้อ จากข้อมูลที่ให้เท่านั้น ถ้าไม่มีให้บอกว่า "ไม่มีปัจจัยหนุนเด่นชัดตอนนี้")\n' +
    'ปัจจัยเสี่ยง: (ไม่เกิน 3 ข้อ จากข้อมูลที่ให้เท่านั้น ถ้าไม่มีให้บอกว่า "ไม่มีปัจจัยเสี่ยงเด่นชัดตอนนี้")\n\n' +
    'ห้ามให้คำแนะนำซื้อ/ขาย ห้ามทำนายราคาในอนาคต ห้ามเติมตัวเลข บริษัท หรือเหตุการณ์ที่ไม่ได้อยู่ในข้อมูลที่ให้มาเด็ดขาด';
  var AI_SUMMARY_REMINDER = 'ย้ำ: ห้ามให้คำแนะนำซื้อ/ขาย ห้ามทำนายราคาในอนาคต ห้ามเติมตัวเลข/เหตุการณ์ที่ไม่ได้อยู่ในข้อมูลที่ให้มา ' +
    'ตอบตามโครงสร้าง 3 หัวข้อที่กำหนดเท่านั้น เริ่มที่ "สรุปภาพรวม:" ทันที ห้ามขึ้นต้นด้วยคำนำ';
  var AI_SUMMARY_SYSTEM_PROMPT_EN = 'You are an assistant who summarizes stock data for a novice retail investor. You will be given ' +
    'pre-computed numbers/technical signals (never calculate or guess extra numbers yourself — use only the numbers given). ' +
    'Your job is to phrase this as plain, easy-to-understand language, not as an investment advisor. ' +
    'Reply in English using ONLY this structure (do not start with any preamble — start directly with "Overview:"):\n\n' +
    'Overview: (1-2 sentences explaining the current price status in plain terms, from the data given)\n' +
    'Tailwinds: (up to 3 bullet points, only from the data given — if none, say "No clear tailwinds right now")\n' +
    'Risks: (up to 3 bullet points, only from the data given — if none, say "No clear risks right now")\n\n' +
    'Never give buy/sell advice. Never predict future prices. Never add numbers, companies, or events not present in the data given.';
  var AI_SUMMARY_REMINDER_EN = 'Reminder: never give buy/sell advice, never predict future prices, never add numbers/events not present in the data given. ' +
    'Reply using only the 3-section structure above, starting directly with "Overview:" — no preamble.';

  function isIOS() {
    if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) return true;
    return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
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

  function currentSymbolLabel() {
    return (lastSource && lastSource.label) ? lastSource.label : (($('sym').value || '').trim().toUpperCase() || t('thisStockFallback'));
  }
  function buildStockContext() {
    var a = lastAnalysis; if (!a) return null;
    var sym = currentSymbolLabel();
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
    return lines.join('\n');
  }

  /* แคชผลสรุปผ่าน Firebase (ai-summary-cache.js) — "คำนวณครั้งเดียวต่อวันต่อหุ้น อ่านซ้ำได้ฟรี"
     ผู้ใช้คนแรกของวันที่กดสรุปหุ้นตัวนี้จะรันโมเดลในเครื่องตามปกติทุกประการ (เหมือนเดิมไม่มีอะไรเปลี่ยน)
     แล้วผลลัพธ์จะถูกแคชไว้ให้คนถัดไปอ่านได้ทันทีโดยไม่ต้องรันโมเดลเลย (ดูรายละเอียด/ข้อจำกัดที่ตั้งใจไว้ใน
     ai-summary-cache.js) — ai-summary-cache.js อาจไม่โหลด (ยังไม่ได้ผูกไว้ในหน้านี้) หรือ Firebase อ่าน/เขียน
     ไม่ได้ (ยังไม่ได้ deploy กติกาใหม่, ออฟไลน์ ฯลฯ) ก็ตกไปรันโมเดลสดตามปกติเสมอ ไม่มีวันพังเพราะเรื่องนี้ */
  var AI_CACHE_PAGE = 'globalstock';
  function doAiSummary() {
    if (aiSumBusy) return;
    if (isIOS()) { setAiSumStatus(t('iosNotSupported'), 'err'); return; }
    var ctx = buildStockContext();
    if (!ctx) { setAiSumStatus(t('needStockData'), 'err'); return; }

    aiSumBusy = true;
    $('aiSumBtn').disabled = true;
    $('aiSumOut').style.display = 'none'; $('aiSumOut').textContent = '';
    setAiSumStatus(t('summarizing'), '');

    var isEn = getUILang() === 'en';
    var cacheSym = currentSymbolLabel(), cacheLang = isEn ? 'en' : 'th';
    var cache = window.AiSummaryCache;
    (cache ? cache.read(AI_CACHE_PAGE, cacheSym, cacheLang) : Promise.resolve(null)).then(function (hit) {
      if (hit) {
        $('aiSumOut').style.display = 'block'; $('aiSumOut').textContent = hit.text;
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
            $('aiSumOut').textContent = replyText;
          } else if (msg.type === 'done') {
            cleanup();
            if (!replyText) setAiSumStatus(t('summarizeFail'), 'err');
            else if (cache) cache.write(AI_CACHE_PAGE, cacheSym, cacheLang, { text: replyText });
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
        w.postMessage({ type: 'chat', jobId: jobId, messages: payloadMessages, maxNewTokens: 160 });
      });
    }
  }

  function doAnalyze() {
    if (lastSeries) { useSeries(lastSeries); return; }
    var price = num($('price').value), hi = num($('hi').value), lo = num($('lo').value);
    if (!isFinite(price)) { setStatus(t('enterPriceFirst'), 'err'); return; }
    updatePriceFx();
    $('chartCard').style.display = 'none';
    if (isFinite(hi) && isFinite(lo) && hi > lo) showAnalysis(analyzeSimple(price, hi, lo));
    else {
      showAnalysis({ light: 'gray', verdict: t('gapNeedInfo'), why: t('gapNeedInfoWhy'), pros: [], cons: [], price: price, suggestStop: price * 0.95, resistance: NaN, det: {}, simple: true });
      $('detailsBox').style.display = 'none';
    }
  }
  /* ══════ Live Market Data Gateway ═════════════════════════════════════
     ลำดับความสำคัญ: Tanot Gateway ของตัวเอง (ถ้าตั้งค่าไว้) -> Twelve Data (ใส่ API key เอง) -> Yahoo/ย้อนหลัง (เดิม)
     ตั้งค่าเดียวกับหน้าหุ้นไทย (localStorage key ร่วมกัน) — ไม่มี backend ของเว็บนี้ Twelve Data key เก็บเฉพาะเครื่อง */
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
    var u = 'https://api.twelvedata.com/quote?symbol=' + encodeURIComponent(sym) + '&apikey=' + encodeURIComponent(c.apiKey);
    return fetchJson(u).then(function (j) { if (j && j.status === 'error') throw new Error(j.message || 'Twelve Data error'); var q = normalizeLiveQuote(j, sym); q.source = 'Twelve Data'; return q; });
  }
  function applyLiveQuote(q) {
    liveLast = q;
    var p = $('price'); if (p) { p.value = Number(q.price).toFixed(2); p.dispatchEvent(new Event('input', { bubbles: true })); }
    var e = $('entry'); if (e && !e.value) e.value = Number(q.price).toFixed(2);
    var ch = isFinite(q.change) ? (q.change >= 0 ? '+' : '−') + Number(Math.abs(q.change)).toFixed(2) : '—';
    var pct = isFinite(q.pct) ? ' (' + (q.pct >= 0 ? '+' : '') + Number(q.pct).toFixed(2) + '%)' : '';
    var tm = q.timestamp ? new Date(q.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
    setLiveUI('live', t('liveLiveLabel'), t('liveQuoteMeta', { source: q.source, ch: ch, pct: pct, tm: tm }));
    setStatus(t('liveQuoteStatus', { price: Number(q.price).toFixed(2), source: q.source, tm: tm }), 'ok');
  }
  function refreshLiveQuote() {
    if (liveBusy) return; var c = liveCfg(), sym = ($('sym') && $('sym').value || '').trim().toUpperCase();
    if (!sym || c.provider === 'yahoo') { setLiveUI('', t('liveHistoricalLabel'), t('liveHistoricalMeta')); return; }
    liveBusy = true;
    var pr = c.provider === 'twelvedata' ? fetchTwelveQuote(sym, c) : fetchGatewayQuote(sym, c);
    pr.then(applyLiveQuote).catch(function (err) {
      var reason = err && err.message;
      setLiveUI('delay', t('liveFallbackLabel'), reason ? (t('liveFallbackMeta') + ' — ' + reason) : t('liveFallbackMeta'));
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
    var sym = ($('sym').value || '').trim().toUpperCase();
    if (!sym) { setStatus(t('typeSymFirst'), 'err'); return; }
    setStatus(t('fetchingData', { sym: sym })); $('fetchBtn').disabled = true;
    var c = liveCfg();
    var livePromise = c.provider === 'twelvedata' ? fetchTwelveQuote(sym, c) : c.provider === 'gateway' ? fetchGatewayQuote(sym, c) : Promise.reject(new Error('historical'));
    livePromise.then(function (q) {
      applyLiveQuote(q);
      return getSeries(sym).then(function (r) { var s = r.series; useSeries(s, t('liveFromMsg', { sym: sym, source: q.source, days: s.closes.length }), 'ok', { kind: 'real', label: sym }); });
    }).catch(function () {
      return getSeries(sym).then(function (r) {
        var s = r.series;
        if (r.stale) useSeries(s, t('staleDataMsg', { age: cacheAgeText(r.cachedAt), days: s.closes.length }), 'ok', { kind: 'real', label: sym, stale: true, cachedAt: r.cachedAt });
        else useSeries(s, t('histFromMsg', { source: s.source, days: s.closes.length }), 'ok', { kind: 'real', label: sym });
      });
    }).catch(function () { setStatus(t('notFoundMsg', { sym: sym }), 'err'); }).finally(function () { $('fetchBtn').disabled = false; });
  }
  function doDemo() { useSeries(demoData(), t('demoMsg'), 'ok', { kind: 'demo' }); }
  function doPaste() {
    var s = parsePaste($('pasteBox').value || '');
    if (!s) { setStatus(t('pasteAtLeast5'), 'err'); return; }
    useSeries(s, t('pastedMsg', { days: s.closes.length }), 'ok', { kind: 'paste' });
  }

  /* ── คำนวณเงิน (USD) ────────────────────────────────────────── */
  function doCalc() {
    var capital = num($('capital').value), riskPct = num($('riskPct').value);
    var entry = num($('entry').value), stop = num($('stop').value), comm = num($('comm').value);
    if (!isFinite(entry)) entry = num($('price').value);
    if (!isFinite(entry)) { setStatus(t('enterEntryFirst'), 'err'); return; }
    if (!isFinite(stop)) { stop = (lastAnalysis && isFinite(lastAnalysis.suggestStop)) ? lastAnalysis.suggestStop : entry * 0.95; $('stop').value = stop.toFixed(2); }
    if (!isFinite(capital) || capital <= 0) { capital = 10000; $('capital').value = capital; }
    if (!isFinite(riskPct) || riskPct <= 0) { riskPct = 2; $('riskPct').value = riskPct; }
    if (!isFinite(comm) || comm < 0) { comm = 0.20; $('comm').value = comm; }

    var res = riskCalc({ capital: capital, riskPct: riskPct, entry: entry, stop: stop, comm: comm, resistance: lastAnalysis ? lastAnalysis.resistance : NaN });
    var box = $('riskResult');
    if (res.error) {
      $('riskHeadline').innerHTML = '<span style="color:var(--err)">' + res.error + '</span>';
      $('riskKv').innerHTML = ''; $('tpRow').innerHTML = ''; box.classList.add('show'); $('saveBtn').style.display = 'none'; return;
    }
    $('riskHeadline').innerHTML = t('calcHeadline', { shares: fmt0(res.shares), cost: usd0(res.cost), fx: fxSpan(res.cost) });
    var kv = '';
    kv += '<div class="k">' + t('kvRiskIfWrong') + '</div><div class="v risk">' + usd0(res.riskUsd) + fxSpan(res.riskUsd) + '</div>';
    kv += '<div class="k">' + t('kvStopPrice') + '</div><div class="v">' + fmt(stop) + '</div>';
    kv += '<div class="k">' + t('kvBreakeven') + '</div><div class="v">' + fmt(res.breakeven) + '</div>';
    if (isFinite(res.rr)) kv += '<div class="k">' + t('kvRR') + '</div><div class="v">' + fmt(res.rr, 1) + ' : 1</div>';
    $('riskKv').innerHTML = kv;
    $('tpRow').innerHTML = '<span class="tp-chip">' + t('tpLot1', { price: fmt(res.tp1) }) + '</span><span class="tp-chip">' + t('tpLot2', { price: fmt(res.tp2) }) + '</span><span class="tp-chip">' + t('tpLot3', { price: fmt(res.tp3) }) + '</span>';
    if (res.note) $('tpRow').innerHTML += '<div style="flex:1 1 100%;font-size:12px;color:var(--warn);margin-top:6px">ℹ️ ' + res.note + '</div>';
    box.classList.add('show');
    $('saveBtn').style.display = 'inline-flex';
    $('saveBtn')._data = { sym: ($('sym').value || '').trim().toUpperCase() || t('thisStockFallback'), shares: res.shares, cost: entry };
  }

  /* ── พอร์ต ──────────────────────────────────────────────────── */
  function loadPf() { try { return JSON.parse(localStorage.getItem(PF_KEY)) || []; } catch (e) { return []; } }
  function savePf(a) { try { localStorage.setItem(PF_KEY, JSON.stringify(a)); } catch (e) {} DriveSync.scheduleSync(); }
  function renderPf() {
    var pf = loadPf(), box = $('pfBox');
    if (!pf.length) { box.innerHTML = '<div class="pf-empty">' + t('pfEmptyDefault') + '</div>'; return; }
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
        cell.innerHTML = (pl >= 0 ? '+' : '−') + usd0(Math.abs(pl)) + ' (' + (pct >= 0 ? '+' : '') + fmt(pct, 1) + '%)' + fxSpan(pl);
        cell.className = 'pf-pl ' + (pl >= 0 ? 'up' : 'down');
      }
      inp.addEventListener('input', function () { upd(); h.cur = num(inp.value); savePf(pf); });
      tr.querySelector('.pf-del').addEventListener('click', function () { pf.splice(i, 1); savePf(pf); renderPf(); });
      tr.querySelector('.pf-sell').addEventListener('click', function () {
        sellCell.innerHTML = '<div class="sell-verdict warn">' + t('fetchingSellPrice', { sym: h.sym }) + '</div>';
        getSeries(h.sym).then(function (r) {
          var s = r.series, a = analyzeSeries(s), v = sellVerdict(a), price = s.closes[s.closes.length - 1];
          inp.value = price.toFixed(2); h.cur = price; savePf(pf); upd();
          var pl = (price - h.cost) * h.shares, pct = (price / h.cost - 1) * 100;
          sellCell.innerHTML = '<div class="sell-detail"><div class="sell-verdict ' + v.cls + '">' + v.headline +
            '<br><span style="font-weight:500">' + t('sellLatestPrice', { price: fmt(price) }) + (r.stale ? t('sellSavedAge', { age: cacheAgeText(r.cachedAt) }) : '') +
            t('sellCostLabel', { cost: fmt(h.cost) }) + (pl >= 0 ? t('sellProfit') : t('sellLoss')) + usd0(Math.abs(pl)) + fxSpan(pl) + ' (' + (pct >= 0 ? '+' : '') + fmt(pct, 1) + '%)</span>' +
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
      var adxTxt = isFinite(det.adx) ? (det.adx >= 20 ? t('chkAdxStrong', { adx: det.adx.toFixed(0) }) : t('chkAdxWeak', { adx: det.adx.toFixed(0) })) : '';
      checks.push({ ok: up, txt: (up ? t('chkTrendUp') : t('chkTrendDn')) + adxTxt });
      var over = (a.price - det.ema20) / det.ema20, notChase = over <= 0.05;
      checks.push({ ok: notChase, txt: notChase ? t('chkNoChase') : t('chkChasing') });
    } else {
      checks.push({ ok: null, txt: t('chkTrendUnknown') });
    }
    if (a && isFinite(det.rsi)) checks.push({ ok: det.rsi < 70, txt: det.rsi < 70 ? t('chkRsiOk', { rsi: det.rsi.toFixed(0) }) : t('chkRsiHot', { rsi: det.rsi.toFixed(0) }) });
    else checks.push({ ok: null, txt: t('chkRsiUnknown') });
    var stopOk = isFinite(entry) && isFinite(stop) && stop < entry;
    checks.push({ ok: stopOk, txt: stopOk ? t('chkStopSet') : t('chkStopUnset') });
    checks.push({ ok: isFinite(riskPct) && riskPct <= 2, txt: (isFinite(riskPct) && riskPct <= 2) ? t('chkRiskOk', { riskPct: riskPct }) : t('chkRiskHigh', { riskPct: isFinite(riskPct) ? riskPct + '%' : '-' }) });
    if (a && isFinite(a.resistance) && stopOk && a.resistance > entry) {
      var rr = (a.resistance - entry) / (entry - stop), rrOk = rr >= 2;
      checks.push({ ok: rrOk, txt: rrOk ? t('chkRrOk', { rr: rr.toFixed(1) }) : t('chkRrLow', { rr: rr.toFixed(1) }) });
    } else {
      checks.push({ ok: null, txt: t('chkRrUnknown') });
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
      var ic = c.ok === true ? '' : c.ok === false ? '' : '◻️';
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
    var beWin = lr / (wr + lr) * 100; /* อัตราชนะที่ต้องมีเพื่อเสมอตัว */
    var msg = t('expMsg', { sign: exp >= 0 ? '+' : '', exp: exp.toFixed(2), sign2: exp >= 0 ? '+' : '−', amt: usd0(Math.abs(exp) * 1000), be: beWin.toFixed(0) });
    if (exp > 0.1) { box.className = 'verdict-box go'; box.innerHTML = t('expGoodPrefix') + msg + t('expGoodSuffix'); }
    else if (exp > 0) { box.className = 'verdict-box warn'; box.innerHTML = t('expBreakevenPrefix') + msg + t('expBreakevenSuffix'); }
    else { box.className = 'verdict-box no'; box.innerHTML = t('expBadPrefix') + msg + t('expBadSuffix'); }
    box.style.display = 'block';
  }

  /* ── สมุดเทรด + สถิติ ────────────────────────────────────────── */
  var JN_KEY = 'tanot:invest:globaljournal';
  function loadJn() { try { return JSON.parse(localStorage.getItem(JN_KEY)) || []; } catch (e) { return []; } }
  function saveJn(a) { try { localStorage.setItem(JN_KEY, JSON.stringify(a)); } catch (e) {} DriveSync.scheduleSync(); }
  function addJournal() {
    var sym = ($('jSym').value || '').trim().toUpperCase() || t('jSymFallback');
    var en = num($('jEntry').value), ex = num($('jExit').value), sh = num($('jShares').value);
    if (!isFinite(en) || !isFinite(ex) || !isFinite(sh) || sh <= 0) { alert(t('alertJournalFields')); return; }
    var jn = loadJn(); jn.push({ sym: sym, en: en, ex: ex, sh: sh, pl: (ex - en) * sh, ts: Date.now() });
    saveJn(jn); $('jEntry').value = ''; $('jExit').value = ''; $('jShares').value = ''; renderJournal();
  }
  function renderJournal() {
    var jn = loadJn(), box = $('jBox'), stats = $('jStats');
    if (!jn.length) { box.innerHTML = '<div class="pf-empty" style="font-size:13px;color:var(--muted);padding:8px 0">' + t('jEmptyDefault') + '</div>'; stats.style.display = 'none'; return; }
    var wins = jn.filter(function (r) { return r.pl > 0; }), losses = jn.filter(function (r) { return r.pl <= 0; });
    var total = jn.reduce(function (s, r) { return s + r.pl; }, 0);
    var winRate = wins.length / jn.length * 100;
    var avgWin = wins.length ? wins.reduce(function (s, r) { return s + r.pl; }, 0) / wins.length : 0;
    var avgLoss = losses.length ? Math.abs(losses.reduce(function (s, r) { return s + r.pl; }, 0) / losses.length) : 0;
    var expUsd = (winRate / 100) * avgWin - (1 - winRate / 100) * avgLoss;
    stats.style.display = 'grid';
    stats.innerHTML =
      '<div class="j-stat"><div class="lbl">' + t('jStatCount') + '</div><div class="val">' + jn.length + '</div></div>' +
      '<div class="j-stat"><div class="lbl">' + t('jStatWinRate') + '</div><div class="val">' + winRate.toFixed(0) + '%</div></div>' +
      '<div class="j-stat"><div class="lbl">' + t('jStatTotalPl') + '</div><div class="val" style="color:' + (total >= 0 ? 'var(--ok)' : 'var(--err)') + '">' + (total >= 0 ? '+' : '−') + usd0(Math.abs(total)) + '</div></div>' +
      '<div class="j-stat"><div class="lbl">' + t('jStatExpectancy') + '</div><div class="val" style="color:' + (expUsd >= 0 ? 'var(--ok)' : 'var(--err)') + '">' + (expUsd >= 0 ? '+' : '−') + usd0(Math.abs(expUsd)) + '</div></div>';
    var html = '<table class="j-table"><thead><tr><th>' + t('jThSym') + '</th><th>' + t('jThEntry') + '</th><th>' + t('jThExit') + '</th><th>' + t('jThShares') + '</th><th>' + t('jThResult') + '</th><th></th></tr></thead><tbody>';
    jn.slice().reverse().forEach(function (r, ri) {
      var idx = jn.length - 1 - ri;
      html += '<tr><td>' + r.sym + '</td><td>' + fmt(r.en) + '</td><td>' + fmt(r.ex) + '</td><td>' + fmt0(r.sh) + '</td>' +
        '<td class="' + (r.pl >= 0 ? 'j-win' : 'j-loss') + '">' + (r.pl >= 0 ? '+' : '−') + usd0(Math.abs(r.pl)) + '</td>' +
        '<td><button class="j-del" data-i="' + idx + '">✕</button></td></tr>';
    });
    html += '</tbody></table>'; box.innerHTML = html;
    [].forEach.call(box.querySelectorAll('.j-del'), function (b) { b.addEventListener('click', function () { var jn = loadJn(); jn.splice(+b.getAttribute('data-i'), 1); saveJn(jn); renderJournal(); }); });
  }

  /* ══════ หุ้นดัง (US) browser + สแกนเนอร์ ══════ */
  var USLIST = [
    /* เทคโนโลยี */
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'AVGO', 'AMD', 'CRM',
    /* การเงิน/ธนาคาร */
    'JPM', 'BAC', 'V', 'MA', 'GS', 'MS',
    /* สุขภาพ */
    'JNJ', 'UNH', 'PFE', 'ABBV', 'LLY',
    /* สินค้าอุปโภคบริโภคจำเป็น */
    'PG', 'KO', 'PEP', 'WMT', 'COST',
    /* สินค้าฟุ่มเฟือย/ค้าปลีก */
    'MCD', 'NKE', 'SBUX', 'HD', 'DIS', 'NFLX',
    /* พลังงาน */
    'XOM', 'CVX', 'COP',
    /* อุตสาหกรรม */
    'BA', 'CAT', 'GE', 'UPS', 'HON'
  ];

  /* ══════ ข้อมูลบริษัท/กลุ่มธุรกิจ (ข้อมูลอ้างอิงสาธารณะ) ══════ */
  var COMPANY_INFO = {
    AAPL: { name: 'Apple', sector: 'เทคโนโลยี', business: 'ผู้ผลิต iPhone/Mac/iPad และระบบนิเวศบริการดิจิทัล (App Store, iCloud) บริษัทที่มีมูลค่าตลาดสูงที่สุดแห่งหนึ่งของโลก' },
    MSFT: { name: 'Microsoft', sector: 'เทคโนโลยี', business: 'ซอฟต์แวร์องค์กร (Windows, Office 365) และธุรกิจคลาวด์ Azure รายใหญ่อันดับต้นของโลก' },
    GOOGL: { name: 'Alphabet (Google)', sector: 'เทคโนโลยี', business: 'เจ้าของ Google Search, YouTube, Android และธุรกิจโฆษณาออนไลน์/คลาวด์คอมพิวติ้ง' },
    AMZN: { name: 'Amazon', sector: 'เทคโนโลยี', business: 'อีคอมเมิร์ซรายใหญ่ที่สุดของโลก บวกธุรกิจคลาวด์คอมพิวติ้ง AWS ที่ทำกำไรสูง' },
    META: { name: 'Meta Platforms', sector: 'เทคโนโลยี', business: 'เจ้าของ Facebook, Instagram, WhatsApp รายได้หลักจากโฆษณาดิจิทัล' },
    NVDA: { name: 'Nvidia', sector: 'เทคโนโลยี', business: 'ผู้ผลิตชิปกราฟิก/ชิปประมวลผล AI รายใหญ่ที่สุด ครองตลาดฮาร์ดแวร์ฝึกโมเดล AI' },
    TSLA: { name: 'Tesla', sector: 'เทคโนโลยี', business: 'ผู้ผลิตรถยนต์ไฟฟ้าและระบบกักเก็บพลังงาน/โซลาร์เซลล์' },
    AVGO: { name: 'Broadcom', sector: 'เทคโนโลยี', business: 'ผู้ผลิตชิปเซมิคอนดักเตอร์/อุปกรณ์เครือข่าย และซอฟต์แวร์องค์กร' },
    AMD: { name: 'Advanced Micro Devices', sector: 'เทคโนโลยี', business: 'ผู้ผลิตชิปประมวลผล CPU/GPU คู่แข่งหลักของ Intel และ Nvidia' },
    CRM: { name: 'Salesforce', sector: 'เทคโนโลยี', business: 'ซอฟต์แวร์บริหารความสัมพันธ์ลูกค้า (CRM) บนคลาวด์รายใหญ่' },
    JPM: { name: 'JPMorgan Chase', sector: 'การเงิน/ธนาคาร', business: 'ธนาคารพาณิชย์และวาณิชธนกิจรายใหญ่ที่สุดของสหรัฐฯ ตามสินทรัพย์' },
    BAC: { name: 'Bank of America', sector: 'การเงิน/ธนาคาร', business: 'ธนาคารพาณิชย์รายใหญ่ของสหรัฐฯ ให้บริการทั้งลูกค้ารายย่อยและองค์กร' },
    V: { name: 'Visa', sector: 'การเงิน/ธนาคาร', business: 'เครือข่ายประมวลผลการชำระเงินด้วยบัตรรายใหญ่ที่สุดของโลก' },
    MA: { name: 'Mastercard', sector: 'การเงิน/ธนาคาร', business: 'เครือข่ายประมวลผลการชำระเงินด้วยบัตร คู่แข่งหลักของ Visa' },
    GS: { name: 'Goldman Sachs', sector: 'การเงิน/ธนาคาร', business: 'วาณิชธนกิจชั้นนำ เน้นธุรกิจซื้อขายหลักทรัพย์และบริหารสินทรัพย์' },
    MS: { name: 'Morgan Stanley', sector: 'การเงิน/ธนาคาร', business: 'วาณิชธนกิจ เน้นธุรกิจบริหารความมั่งคั่งและตลาดทุน' },
    JNJ: { name: 'Johnson & Johnson', sector: 'สุขภาพ', business: 'ยา เวชภัณฑ์ และอุปกรณ์การแพทย์ครบวงจร' },
    UNH: { name: 'UnitedHealth Group', sector: 'สุขภาพ', business: 'บริษัทประกันสุขภาพรายใหญ่ที่สุดของสหรัฐฯ และธุรกิจบริการสุขภาพ Optum' },
    PFE: { name: 'Pfizer', sector: 'สุขภาพ', business: 'บริษัทยาและวัคซีนรายใหญ่ระดับโลก' },
    ABBV: { name: 'AbbVie', sector: 'สุขภาพ', business: 'บริษัทยา เน้นกลุ่มยาภูมิคุ้มกันบำบัดและมะเร็ง' },
    LLY: { name: 'Eli Lilly', sector: 'สุขภาพ', business: 'บริษัทยา เด่นด้านยาเบาหวาน/ลดน้ำหนัก (กลุ่ม GLP-1) เติบโตเร็วในช่วงหลัง' },
    PG: { name: 'Procter & Gamble', sector: 'สินค้าอุปโภคบริโภคจำเป็น', business: 'สินค้าอุปโภคในครัวเรือน (Pampers, Gillette, Tide ฯลฯ) แบรนด์ทั่วโลก' },
    KO: { name: 'Coca-Cola', sector: 'สินค้าอุปโภคบริโภคจำเป็น', business: 'ผู้ผลิตเครื่องดื่มรายใหญ่ระดับโลก เจ้าของแบรนด์ Coca-Cola' },
    PEP: { name: 'PepsiCo', sector: 'สินค้าอุปโภคบริโภคจำเป็น', business: 'ธุรกิจเครื่องดื่ม (Pepsi) และขนมขบเคี้ยว (Lay\'s, Quaker)' },
    WMT: { name: 'Walmart', sector: 'สินค้าอุปโภคบริโภคจำเป็น', business: 'เชนค้าปลีก/ซูเปอร์เซ็นเตอร์รายใหญ่ที่สุดของโลกตามรายได้' },
    COST: { name: 'Costco', sector: 'สินค้าอุปโภคบริโภคจำเป็น', business: 'ธุรกิจค้าปลีกแบบสมาชิก (membership warehouse) ขายส่งราคาถูก' },
    MCD: { name: "McDonald's", sector: 'สินค้าฟุ่มเฟือย/ค้าปลีก', business: 'เชนอาหารจานด่วนแฟรนไชส์รายใหญ่ที่สุดของโลก' },
    NKE: { name: 'Nike', sector: 'สินค้าฟุ่มเฟือย/ค้าปลีก', business: 'แบรนด์รองเท้า/เครื่องแต่งกายกีฬารายใหญ่ที่สุดของโลก' },
    SBUX: { name: 'Starbucks', sector: 'สินค้าฟุ่มเฟือย/ค้าปลีก', business: 'เชนร้านกาแฟรายใหญ่ที่สุดของโลก' },
    HD: { name: 'Home Depot', sector: 'สินค้าฟุ่มเฟือย/ค้าปลีก', business: 'เชนค้าปลีกวัสดุก่อสร้าง/ตกแต่งบ้านรายใหญ่ที่สุดของสหรัฐฯ' },
    DIS: { name: 'Disney', sector: 'สินค้าฟุ่มเฟือย/ค้าปลีก', business: 'ธุรกิจสื่อ/บันเทิง สวนสนุก และสตรีมมิง (Disney+)' },
    NFLX: { name: 'Netflix', sector: 'สินค้าฟุ่มเฟือย/ค้าปลีก', business: 'บริการสตรีมมิงวิดีโอรายใหญ่ที่สุดของโลก' },
    XOM: { name: 'ExxonMobil', sector: 'พลังงาน', business: 'บริษัทน้ำมัน/ก๊าซครบวงจรรายใหญ่ของสหรัฐฯ' },
    CVX: { name: 'Chevron', sector: 'พลังงาน', business: 'บริษัทน้ำมัน/ก๊าซครบวงจรรายใหญ่ของสหรัฐฯ' },
    COP: { name: 'ConocoPhillips', sector: 'พลังงาน', business: 'ธุรกิจสำรวจและผลิตปิโตรเลียม (น้ำมัน/ก๊าซ)' },
    BA: { name: 'Boeing', sector: 'อุตสาหกรรม', business: 'ผู้ผลิตเครื่องบินพาณิชย์และอากาศยานทางทหารรายใหญ่ของโลก' },
    CAT: { name: 'Caterpillar', sector: 'อุตสาหกรรม', business: 'ผู้ผลิตเครื่องจักรก่อสร้าง/เหมืองแร่รายใหญ่ของโลก' },
    GE: { name: 'General Electric', sector: 'อุตสาหกรรม', business: 'กลุ่มอุตสาหกรรม เน้นเครื่องยนต์อากาศยานและพลังงาน' },
    UPS: { name: 'United Parcel Service', sector: 'อุตสาหกรรม', business: 'ธุรกิจขนส่งพัสดุ/โลจิสติกส์รายใหญ่ของโลก' },
    HON: { name: 'Honeywell', sector: 'อุตสาหกรรม', business: 'กลุ่มอุตสาหกรรม ครอบคลุมการบิน อาคารอัตโนมัติ และวัสดุ' }
  };
  var SECTOR_FACTORS = {
    'เทคโนโลยี': ['มูลค่าหุ้นมักตั้งราคาด้วยความคาดหวังการเติบโตสูง อ่อนไหวกับทิศทางดอกเบี้ยสหรัฐฯ (Fed)', 'การแข่งขันด้าน AI/นวัตกรรมเปลี่ยนเร็ว งบวิจัยพัฒนาสูงต่อเนื่อง'],
    'การเงิน/ธนาคาร': ['ผลประกอบการอ่อนไหวกับดอกเบี้ยนโยบาย Fed และคุณภาพสินเชื่อ', 'กฎเกณฑ์กำกับดูแลธนาคารสหรัฐฯ (Fed/FDIC) มีผลโดยตรง'],
    'สุขภาพ': ['ขึ้นกับผลทดลองยา/การอนุมัติจาก FDA และการหมดสิทธิบัตร (patent cliff)', 'นโยบายราคายา/ประกันสุขภาพของรัฐบาลสหรัฐฯ มีผลต่อรายได้'],
    'สินค้าอุปโภคบริโภคจำเป็น': ['อ่อนไหวกับต้นทุนวัตถุดิบและค่าเงินดอลลาร์ (รายได้ส่วนหนึ่งมาจากต่างประเทศ)', 'มักเป็นหุ้นตั้งรับ (defensive) ผันผวนน้อยกว่ากลุ่มเทคโนโลยี'],
    'สินค้าฟุ่มเฟือย/ค้าปลีก': ['ยอดขายอ่อนไหวกับกำลังซื้อผู้บริโภคสหรัฐฯ และฤดูกาลจับจ่าย', 'ต้นทุนแรงงาน/ค่าเช่าและการแข่งขันอีคอมเมิร์ซกดดันมาร์จิ้น'],
    'พลังงาน': ['กำไรผันผวนตามราคาน้ำมัน/ก๊าซในตลาดโลก', 'นโยบายพลังงาน/สิ่งแวดล้อมของสหรัฐฯ มีผลต่อการลงทุนระยะยาว'],
    'อุตสาหกรรม': ['รายได้ผูกกับวัฏจักรเศรษฐกิจโลกและการลงทุนโครงสร้างพื้นฐาน', 'อ่อนไหวกับภาษีนำเข้า/ห่วงโซ่อุปทานระหว่างประเทศ']
  };
  var COMPANY_INFO_EN = {
    AAPL: { name: 'Apple', sector: 'Technology', business: 'Maker of iPhone/Mac/iPad and the digital services ecosystem (App Store, iCloud); one of the most valuable companies in the world' },
    MSFT: { name: 'Microsoft', sector: 'Technology', business: 'Enterprise software (Windows, Office 365) and the Azure cloud business, among the largest in the world' },
    GOOGL: { name: 'Alphabet (Google)', sector: 'Technology', business: 'Owner of Google Search, YouTube, Android, and the online advertising/cloud computing business' },
    AMZN: { name: 'Amazon', sector: 'Technology', business: "The world's largest e-commerce company, plus the highly profitable AWS cloud computing business" },
    META: { name: 'Meta Platforms', sector: 'Technology', business: 'Owner of Facebook, Instagram, WhatsApp; revenue mainly from digital advertising' },
    NVDA: { name: 'Nvidia', sector: 'Technology', business: 'The largest maker of graphics/AI processing chips, dominating the AI model training hardware market' },
    TSLA: { name: 'Tesla', sector: 'Technology', business: 'Maker of electric vehicles and energy storage/solar systems' },
    AVGO: { name: 'Broadcom', sector: 'Technology', business: 'Maker of semiconductor chips/networking equipment and enterprise software' },
    AMD: { name: 'Advanced Micro Devices', sector: 'Technology', business: "Maker of CPU/GPU processing chips, Intel and Nvidia's main competitor" },
    CRM: { name: 'Salesforce', sector: 'Technology', business: 'Major cloud-based customer relationship management (CRM) software' },
    JPM: { name: 'JPMorgan Chase', sector: 'Finance/Banking', business: "The largest US commercial and investment bank by assets" },
    BAC: { name: 'Bank of America', sector: 'Finance/Banking', business: 'Major US commercial bank serving both retail and corporate customers' },
    V: { name: 'Visa', sector: 'Finance/Banking', business: "The world's largest card payment processing network" },
    MA: { name: 'Mastercard', sector: 'Finance/Banking', business: "A card payment processing network, Visa's main competitor" },
    GS: { name: 'Goldman Sachs', sector: 'Finance/Banking', business: 'Leading investment bank focused on securities trading and asset management' },
    MS: { name: 'Morgan Stanley', sector: 'Finance/Banking', business: 'Investment bank focused on wealth management and capital markets' },
    JNJ: { name: 'Johnson & Johnson', sector: 'Healthcare', business: 'Full-line pharmaceuticals, medicines, and medical devices' },
    UNH: { name: 'UnitedHealth Group', sector: 'Healthcare', business: 'The largest US health insurer, plus the Optum health services business' },
    PFE: { name: 'Pfizer', sector: 'Healthcare', business: 'Global-scale pharmaceutical and vaccine company' },
    ABBV: { name: 'AbbVie', sector: 'Healthcare', business: 'Pharmaceutical company focused on immunology and oncology drugs' },
    LLY: { name: 'Eli Lilly', sector: 'Healthcare', business: 'Pharmaceutical company known for diabetes/weight-loss drugs (GLP-1 class), growing rapidly in recent years' },
    PG: { name: 'Procter & Gamble', sector: 'Consumer Staples', business: 'Household consumer goods (Pampers, Gillette, Tide, etc.), globally recognized brands' },
    KO: { name: 'Coca-Cola', sector: 'Consumer Staples', business: 'Global-scale beverage maker, owner of the Coca-Cola brand' },
    PEP: { name: 'PepsiCo', sector: 'Consumer Staples', business: "Beverage business (Pepsi) and snack foods (Lay's, Quaker)" },
    WMT: { name: 'Walmart', sector: 'Consumer Staples', business: 'The largest retail/supercenter chain in the world by revenue' },
    COST: { name: 'Costco', sector: 'Consumer Staples', business: 'Membership warehouse retail business selling at low wholesale prices' },
    MCD: { name: "McDonald's", sector: 'Consumer Discretionary/Retail', business: "The world's largest fast-food franchise chain" },
    NKE: { name: 'Nike', sector: 'Consumer Discretionary/Retail', business: "The world's largest sportswear/footwear brand" },
    SBUX: { name: 'Starbucks', sector: 'Consumer Discretionary/Retail', business: "The world's largest coffeehouse chain" },
    HD: { name: 'Home Depot', sector: 'Consumer Discretionary/Retail', business: 'The largest home improvement/building materials retail chain in the US' },
    DIS: { name: 'Disney', sector: 'Consumer Discretionary/Retail', business: 'Media/entertainment, theme parks, and streaming (Disney+) business' },
    NFLX: { name: 'Netflix', sector: 'Consumer Discretionary/Retail', business: "The world's largest video streaming service" },
    XOM: { name: 'ExxonMobil', sector: 'Energy', business: 'Major integrated US oil/gas company' },
    CVX: { name: 'Chevron', sector: 'Energy', business: 'Major integrated US oil/gas company' },
    COP: { name: 'ConocoPhillips', sector: 'Energy', business: 'Petroleum (oil/gas) exploration and production business' },
    BA: { name: 'Boeing', sector: 'Industrials', business: 'Major global manufacturer of commercial and military aircraft' },
    CAT: { name: 'Caterpillar', sector: 'Industrials', business: 'Major global maker of construction/mining machinery' },
    GE: { name: 'General Electric', sector: 'Industrials', business: 'Industrial group focused on aircraft engines and power' },
    UPS: { name: 'United Parcel Service', sector: 'Industrials', business: 'Major global parcel delivery/logistics business' },
    HON: { name: 'Honeywell', sector: 'Industrials', business: 'Industrial group spanning aerospace, building automation, and materials' }
  };
  var SECTOR_FACTORS_EN = {
    'Technology': ['Valuations are usually priced with high growth expectations, sensitive to the direction of US interest rates (the Fed)', 'AI/innovation competition changes fast, with continuously high R&D spending'],
    'Finance/Banking': ["Earnings are sensitive to Fed policy rates and loan quality", "US bank regulation (Fed/FDIC) has a direct effect"],
    'Healthcare': ['Depends on drug trial results/FDA approvals and patent cliffs', "US government drug pricing/health insurance policy affects revenue"],
    'Consumer Staples': ['Sensitive to input costs and the dollar (part of revenue comes from overseas)', 'Usually defensive stocks, less volatile than the technology sector'],
    'Consumer Discretionary/Retail': ['Sales are sensitive to US consumer spending power and shopping seasons', 'Labor/rent costs and e-commerce competition pressure margins'],
    'Energy': ['Profit swings with global oil/gas prices', 'US energy/environmental policy affects long-term investment'],
    'Industrials': ['Revenue is tied to the global economic cycle and infrastructure investment', 'Sensitive to import tariffs/international supply chains']
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

  function fetchPriceScan(sym, startAt) {
    var base = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?range=1y&interval=1d';
    var enc = encodeURIComponent(base);
    var tries = [
      { name: 'own', url: 'https://tanot-cors-proxy.tanot713.workers.dev/?url=' + enc },
      { name: 'allorigins', url: 'https://api.allorigins.win/raw?url=' + enc },
      { name: 'codetabs', url: 'https://api.codetabs.com/v1/proxy/?quest=' + enc },
      { name: 'corseu', url: 'https://cors.eu.org/' + base },
      { name: 'corsworkers', url: 'https://test.cors.workers.dev/?' + base },
      { name: 'corslol', url: 'https://api.cors.lol/?url=' + enc },
      { name: 'ตรง', url: base }
    ];
    /* หมุนจุดเริ่มต่างกันต่อหุ้น กันสแกนหลายสิบตัวรัวถล่ม proxy เดียวจนโดน rate-limit พร้อมกันหมด */
    var offset = ((startAt || 0) % tries.length + tries.length) % tries.length;
    tries = tries.slice(offset).concat(tries.slice(0, offset));
    var i = 0, best = null;
    function next() {
      if (i >= tries.length) return best ? Promise.resolve(best) : Promise.reject(new Error('fail'));
      var t = tries[i++];
      return fetchOne(t.url, 7000).then(function (s) {
        s.source = t.name; if (!best || s.closes.length > best.closes.length) best = s;
        if (best.closes.length >= 40) return best; return next();
      }, function () { return next(); });
    }
    return next();
  }

  function selectUl(sym) {
    $('sym').value = sym; doFetch();
    var lc = $('lightCard'); if (lc && lc.scrollIntoView) setTimeout(function () { lc.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 250);
  }
  /* ── ตารางหุ้นดัง (US) ── */
  var ulRows = {};
  function rankOf(l) { return l === 'green' ? 0 : l === 'yellow' ? 1 : l === 'red' ? 2 : 9; }
  function sigIcon(l) {
    var color = l === 'green' ? 'var(--ok)' : l === 'yellow' ? 'var(--amber)' : l === 'red' ? 'var(--err)' : '';
    return color ? '<span class="sig-dot" style="background:' + color + '"></span>' : '·';
  }
  function dataFromSeries(s) {
    if (!s || s.closes.length < 2) return null;
    var last = s.closes[s.closes.length - 1], prev = s.closes[s.closes.length - 2];
    var light = ''; if (s.closes.length >= 20) { try { light = analyzeSeries(s).light; } catch (e) {} }
    return { last: last, chg: last - prev, pct: prev ? (last - prev) / prev * 100 : 0, light: light };
  }
  function fillRow(tr, sym, d) {
    if (!d) {
      tr.innerHTML = '<td class="c-sym">' + sym + '</td><td class="muted">–</td><td class="muted c-chg">–</td><td class="muted">–</td><td class="c-sig muted">' + t('ulRowLoading') + '</td>';
      tr.setAttribute('data-rank', 9); tr.setAttribute('data-light', ''); return;
    }
    var cls = d.chg >= 0 ? 'up' : 'dn', sign = d.chg >= 0 ? '+' : '−';
    tr.innerHTML = '<td class="c-sym">' + sym + '</td>' +
      '<td>' + fmt(d.last) + '</td>' +
      '<td class="c-chg ' + cls + '">' + sign + fmt(Math.abs(d.chg)) + '</td>' +
      '<td class="' + cls + '">' + sign + fmt(Math.abs(d.pct), 2) + '%</td>' +
      '<td class="c-sig">' + sigIcon(d.light) + '</td>';
    tr.setAttribute('data-rank', rankOf(d.light)); tr.setAttribute('data-light', d.light || '');
  }
  function renderUlTable() {
    var body = $('ulBody'); if (!body) return;
    body.innerHTML = ''; ulRows = {};
    USLIST.forEach(function (sym) {
      var tr = document.createElement('tr'); tr.setAttribute('data-sym', sym);
      fillRow(tr, sym, dataFromSeries(loadCache(sym)));
      tr.addEventListener('click', function () { selectUl(sym); });
      body.appendChild(tr); ulRows[sym] = tr;
    });
    applyGreenFilter();
  }
  function sortTable() {
    var body = $('ulBody'); if (!body) return;
    var rows = [].slice.call(body.querySelectorAll('tr'));
    rows.sort(function (a, b) {
      var ra = +a.getAttribute('data-rank'), rb = +b.getAttribute('data-rank');
      if (ra !== rb) return ra - rb;
      return a.getAttribute('data-sym') < b.getAttribute('data-sym') ? -1 : 1;
    });
    rows.forEach(function (r) { body.appendChild(r); });
  }
  function applyGreenFilter() {
    var go = $('greenOnly') && $('greenOnly').checked;
    Object.keys(ulRows).forEach(function (sym) {
      var tr = ulRows[sym]; tr.style.display = (go && tr.getAttribute('data-light') !== 'green') ? 'none' : '';
    });
  }

  var scanning = false;
  function doScan() {
    if (scanning) { scanning = false; return; }
    var idx = 0, ok = 0, green = 0;
    scanning = true; $('scanBtn').textContent = t('scanBtnStop');
    function fin() {
      scanning = false; $('scanBtn').textContent = t('scanIdle');
      $('scanStatus').textContent = t('scanDone', { ok: ok, total: USLIST.length, green: green });
      sortTable(); applyGreenFilter();
    }
    function step() {
      if (!scanning || idx >= USLIST.length) { fin(); return; }
      var sym = USLIST[idx++];
      $('scanStatus').textContent = t('scanProgress', { idx: idx, total: USLIST.length, sym: sym });
      var cached = loadCache(sym), fresh = cached && (Date.now() - cached.cachedAt < 6 * 3600 * 1000);
      var pr = fresh ? Promise.resolve(cached) : fetchPriceScan(sym, idx).then(function (s) { saveCache(sym, s); return s; }, function () { return cached || null; });
      pr.then(function (s) {
        var d = dataFromSeries(s);
        if (d) { ok++; if (d.light === 'green') green++; if (ulRows[sym]) fillRow(ulRows[sym], sym, d); }
        if (idx % 5 === 0) { sortTable(); applyGreenFilter(); }
        setTimeout(step, 150);
      });
    }
    step();
  }

  function addHolding() {
    var sym = ($('pfSym').value || '').trim().toUpperCase();
    var shares = num($('pfShares').value), cost = num($('pfCost').value);
    if (!sym) { alert(t('alertEnterSym')); return; }
    if (!isFinite(shares) || shares <= 0 || !isFinite(cost) || cost <= 0) { alert(t('alertEnterValid')); return; }
    var pf = loadPf(); pf.push({ sym: sym, shares: shares, cost: cost, ts: Date.now() });
    savePf(pf); $('pfSym').value = ''; $('pfShares').value = ''; $('pfCost').value = ''; renderPf();
  }

  /* ── "ควรขายไหม" สำหรับหุ้นที่ถือ ─────────────────────────────── */
  function sellVerdict(a) {
    var det = a.det || {}, ps = det.psar;
    var cls, headline;
    if (ps && !ps.up) { cls = 'no'; headline = t('sellSarDn'); }
    else if (!a.uptrend || (isFinite(det.ema20) && a.price < det.ema20)) { cls = 'no'; headline = t('sellBelowTrend'); }
    else if (isFinite(a.rsi) && a.rsi > 70) { cls = 'warn'; headline = t('sellHotRsi'); }
    else if (isFinite(a.resistance) && a.price >= a.resistance * 0.98) { cls = 'warn'; headline = t('sellNearResist'); }
    else { cls = 'go'; headline = t('sellHold'); }

    /* ราคาหลายระดับตามสถานการณ์ — คำนวณทุกครั้งจากตัวเลขที่ analyzeSeries มีอยู่แล้ว ไม่ขึ้นกับ branch ไหน trigger */
    var levels = [
      {
        key: 'sar', type: 'stop', label: t('sarLabel'),
        price: ps ? ps.sar : NaN,
        reason: !ps ? t('sarNoData')
          : (ps.up ? t('sarUpReason', { sar: fmt(ps.sar) }) : t('sarDnReason'))
      },
      {
        key: 'stop', type: 'stop', label: t('stopRiskLabel'),
        price: a.suggestStop,
        reason: !isFinite(a.suggestStop) ? t('noData')
          : t('stopRiskReason', { atr: isFinite(det.atr) ? t('atrSuffix', { atr: fmt(det.atr) }) : '' })
      },
      {
        key: 'ema20', type: 'warn', label: t('ema20Label'),
        price: det.ema20,
        reason: !isFinite(det.ema20) ? t('noData') : t('ema20Reason')
      },
      {
        key: 'resistance', type: 'tp', label: t('resistLabel'),
        price: isFinite(det.resistance) ? det.resistance : a.resistance,
        reason: !isFinite(isFinite(det.resistance) ? det.resistance : a.resistance) ? t('noData') : t('resistReason')
      }
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

  /* ══════ ข่าวล่าสุด (best-effort) — ไม่บล็อกอะไร ถ้าดึงไม่ได้มีลิงก์ค้นเองเสมอ ══════ */
  function newsSearchUrl(sym) {
    return 'https://news.google.com/search?q=' + encodeURIComponent(sym + ' stock') + '&hl=en-US&gl=US&ceid=US:en';
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
  function fetchNewsScan(sym) {
    var base = 'https://news.google.com/rss/search?q=' + encodeURIComponent(sym + ' stock OR company') + '&hl=en-US&gl=US&ceid=US:en';
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
    var i = 0;
    function next() {
      if (i >= tries.length) return Promise.reject(new Error('all failed'));
      var t = tries[i++];
      return fetchOne(t.url, 7000, parseNewsRss).catch(function () { return next(); });
    }
    return next();
  }
  function newsCacheKey(sym) { return 'tanot:invest:newscache:us:' + sym; }
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
    var link = '<a class="news-search-link" target="_blank" rel="noopener" href="' + newsSearchUrl(sym) + '">' + t('searchNewsMyself') + '</a>';
    el.innerHTML = t('searchingNews', { sym: sym }) + link;
    fetchNews(sym).then(function (r) {
      var html = '<ul class="news-list">' + r.items.map(function (n) {
        return '<li><a href="' + n.link + '" target="_blank" rel="noopener">' + n.title + '</a><span class="news-date">' + newsDateShort(n.pubDate) + '</span></li>';
      }).join('') + '</ul>' + t('moreNews') + link;
      el.innerHTML = html;
    }, function () {
      el.innerHTML = t('newsAutoFail') + link;
    });
  }

  /* ══════ สำรองพอร์ต + สมุดเทรดขึ้น Google Drive (ไม่บังคับ) ══════
     ใช้ OAuth client เดียวกับหน้าอื่นในเว็บนี้ (scope drive.file — แตะได้เฉพาะไฟล์ที่แอปนี้สร้างเอง)
     ไฟล์คนละชื่อกับหน้าหุ้นไทย (แต่โฟลเดอร์เดียวกัน) ไม่ปนกัน
     เชื่อมต่อครั้งแรกต้องกดปุ่ม (ข้อจำกัดเบราว์เซอร์ต้องมี user gesture) จากนั้นซิงก์อัตโนมัติเบื้องหลังทุกครั้งที่ข้อมูลเปลี่ยน */
  var DRIVE_CLIENT_ID = '497048581273-akpavakt6m34lhqbjf1irg3m8vl6u27u.apps.googleusercontent.com';
  var DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
  var DRIVE_FOLDER_NAME = 'OME_Progress';
  var DRIVE_FILE_NAME = 'invest-global-stock-data.json';
  var DRIVE_CONNECTED_KEY = 'tanot:invest:globalstock:driveConnected';
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
        if (self.connected) self.tokenClient.requestAccessToken({ prompt: '' }); /* ลองต่อเงียบๆ ถ้าเคยเชื่อมต่อแล้ว */
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
    /* ผสาน portfolio/journal จาก Drive กับเครื่องนี้ โดย ts (เวลาสร้างรายการ) เป็นตัวกันซ้ำ */
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
          var mergedPf = self.mergeByTs(remote && remote.portfolio, loadPf());
          var mergedJn = self.mergeByTs(remote && remote.journal, loadJn());
          /* เขียนตรงลง localStorage (ไม่ผ่าน savePf/saveJn) กันเกิดคิวซิงก์ซ้ำซ้อน — ฟังก์ชันนี้อัปโหลดเองด้านล่างอยู่แล้ว */
          try { localStorage.setItem(PF_KEY, JSON.stringify(mergedPf)); } catch (e) {}
          try { localStorage.setItem(JN_KEY, JSON.stringify(mergedJn)); } catch (e) {}
          renderPf(); renderJournal();
          return self.upload({ portfolio: mergedPf, journal: mergedJn, savedAt: new Date().toISOString() });
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
        .then(function () { return self.upload({ portfolio: loadPf(), journal: loadJn(), savedAt: new Date().toISOString() }); })
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
    $('fetchBtn').addEventListener('click', doFetch);
    initLiveControls();
    $('analyzeBtn').addEventListener('click', doAnalyze);
    $('demoBtn').addEventListener('click', doDemo);
    $('pasteBtn').addEventListener('click', doPaste);
    $('calcBtn').addEventListener('click', doCalc);
    $('sym').addEventListener('keydown', function (e) { if (e.key === 'Enter') doFetch(); });
    ['price', 'hi', 'lo'].forEach(function (id) { $(id).addEventListener('input', function () { lastSeries = null; if (id === 'price') updatePriceFx(); }); });

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
    $('jAdd').addEventListener('click', addJournal);
    $('scanBtn').addEventListener('click', doScan);
    $('greenOnly').addEventListener('change', applyGreenFilter);
    $('pfAdd').addEventListener('click', addHolding);
    $('aiSumBtn').addEventListener('click', doAiSummary);
    $('driveConnectBtn') && $('driveConnectBtn').addEventListener('click', function () { DriveSync.connect(); });

    /* ตัวแปลงสกุลเงิน */
    var fxCached = loadFxCache();
    if (fxCached) { fxRate = fxCached.rate; if ($('fxRate')) $('fxRate').value = fxCached.rate.toFixed(2); }
    $('fxFetchBtn').addEventListener('click', doFxFetch);
    $('fxRate').addEventListener('input', function () { fxRate = num($('fxRate').value); updatePriceFx(); if ($('riskResult').classList.contains('show')) doCalc(); renderPf(); });
    $('fxShowChk').addEventListener('change', function () { updatePriceFx(); if ($('riskResult').classList.contains('show')) doCalc(); renderPf(); });

    renderUlTable();
    renderPf();
    renderJournal();
    DriveSync.init();
  }
  window.omeApplyLang = function () {
    applyStaticI18n();
    if (!scanning) $('scanBtn').textContent = t('scanIdle');
    if ($('checkResult') && $('checkResult').style.display !== 'none' && lastAnalysis) doChecklist();
    if (lastSeries) useSeries(lastSeries);
    renderUlTable();
    renderPf();
    renderJournal();
    DriveSync.setBtn();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.__globalstock = { sma: sma, emaLast: emaLast, rsi: rsi, rsiSeries: rsiSeries, smaSeries: smaSeries, macd: macd, bollinger: bollinger, atr: atr, analyzeSeries: analyzeSeries, analyzeSimple: analyzeSimple, riskCalc: riskCalc, demoData: demoData, parsePaste: parsePaste, parseYahoo: parseYahoo, checklistChecks: checklistChecks, adx: adx, psar: psar, sellVerdict: sellVerdict, companyInfoHtml: companyInfoHtml, newsSearchUrl: newsSearchUrl, parseNewsRss: parseNewsRss };
})();
