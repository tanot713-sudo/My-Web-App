/* ══════════════════════════════════════════════════════════════════
   Tanot — Bitcoin (เทรดสวิงคุมความเสี่ยง + ออม DCA)
   • กราฟแท่งเทียนจริงด้วย lightweight-charts (TradingView, Apache-2.0)
   • ดึงราคา BTC-USD (Yahoo Finance) แบบ best-effort หลายเส้นทาง
   • คำนวณอินดิเคเตอร์เอง (SMA/EMA/RSI/MACD/Bollinger/ATR) → แปลเป็นไฟจราจร
   • ดัชนีความกลัว-ความโลภ (Fear & Greed, alternative.me) — บริบทประกอบ ไม่ใช่สัญญาณเข้า/ออก
   • แกนหลัก: คุมเงิน/ความเสี่ยง เป็น USD (ซื้อ BTC เศษส่วนได้), เสี่ยงต่อไม้≤1%, ห้ามเลเวอเรจ
   • ออม BTC แบบ DCA (calculator ล้วนๆ ไม่เก็บ state — พอร์ต/สมุดเทรดด้านล่างเก็บ state จริงอยู่แล้ว)
   หมายเหตุ: ตัวช่วยคิด ไม่ใช่คำแนะนำการลงทุน
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var PF_KEY = 'tanot:invest:btc';
  var JN_KEY = 'tanot:invest:btcjournal';
  var lastSeries = null;
  var lastAnalysis = null;
  var SYM = 'BTC-USD';

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }
  function fmt(n, d) { d = d == null ? 2 : d; return isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'; }
  function fmt0(n) { return isFinite(n) ? Math.round(n).toLocaleString('en-US') : '—'; }
  function usd(n, d) { if (!isFinite(n)) return '—'; var neg = n < 0; d = d == null ? 2 : d; return (neg ? '−' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function usd0(n) { if (!isFinite(n)) return '—'; var neg = n < 0; return (neg ? '−' : '') + '$' + Math.round(Math.abs(n)).toLocaleString('en-US'); }
  function baht(n) { if (!isFinite(n)) return '—'; var neg = n < 0; return (neg ? '−' : '') + '฿' + Math.round(Math.abs(n)).toLocaleString('th-TH'); }

  /* ══════ ระบบสองภาษา (ไทย/อังกฤษ) — ตามธรรมเนียมเดียวกับ invest-gold.js ══════ */
  var UI_LANG_KEY = 'ome:lang';
  function getUILang() { try { return localStorage.getItem(UI_LANG_KEY) === 'en' ? 'en' : 'th'; } catch (e) { return 'th'; } }
  var I18N = {
    th: {
      navInvest: 'การลงทุน', pageTitle: 'Bitcoin — ตัวช่วยเข้า/ออก + ออม',
      step1Title: 'ราคา BTC-USD ตอนนี้',
      lblPriceNow: 'ราคาตอนนี้ (USD)', phPriceNow: 'เช่น 65000',
      lblHi: 'ราคาสูงสุดของรอบ', lblLo: 'ราคาต่ำสุดของรอบ', ph3mo: 'ช่วง 3 เดือน',
      marketModeHist: 'โหมดข้อมูล: ย้อนหลัง', marketModeLive: 'โหมดข้อมูล: สด / Real-time', marketModeFallback: 'โหมดข้อมูล: สำรอง / Historical',
      marketMetaDefault: 'ตั้งค่าแหล่งข้อมูลสดได้ใน "ตั้งค่าข้อมูลตลาด"',
      marketMetaHistoricalUse: 'ใช้ Yahoo สำหรับกราฟย้อนหลัง',
      marketMetaFallback: 'แหล่งข้อมูลสดยังเชื่อมต่อไม่ได้ · ใช้ราคาย้อนหลังเป็น fallback',
      marketRefreshBtn: '↻ รีเฟรช', marketSettingsBtn: '⚙️ ตั้งค่าข้อมูลตลาด',
      marketSettingsTitle: 'ข้อมูลตลาดแบบสด',
      marketProviderLbl: 'แหล่งข้อมูล', marketProviderGateway: 'Tanot Data Gateway (แนะนำ)', marketProviderTwelve: 'Twelve Data', marketProviderYahoo: 'Yahoo / ย้อนหลัง',
      marketGatewayLbl: 'Gateway URL', marketApiKeyNote: '(เก็บในเครื่องเท่านั้น)', marketApiKeyPh: 'ใส่เมื่อมี API key',
      marketIntervalLbl: 'รีเฟรชทุก', marketInterval5: '5 วินาที', marketInterval10: '10 วินาที', marketInterval30: '30 วินาที',
      marketSaveBtn: 'บันทึกการตั้งค่า', marketClearBtn: 'ล้าง API Key',
      marketSavedMsg: 'บันทึกการตั้งค่าแล้ว · ระบบจะดึงข้อมูลตามช่วงเวลาที่ตั้ง', marketApiKeyCleared: 'ล้าง API Key จากเครื่องแล้ว',
      fetchBtn: 'ลองดึงราคา', analyzeBtn: 'ประเมินให้หน่อย', demoBtn: 'ดูกราฟตัวอย่าง (ฝึกอ่าน)',
      pasteSummary: 'วางราคาย้อนหลังเอง (ทางเลือก)', pasteHint: 'วางราคาปิดหลายวัน คั่นด้วยเว้นวรรค/บรรทัด/จุลภาค (เรียงเก่า→ใหม่)', pasteBtn: 'ใช้ราคานี้',
      fxSummary: 'แปลงเป็นเงินบาท (ทางเลือก)',
      fxRateLbl: 'อัตราแลกเปลี่ยน', fxRateUnit: '(บาทต่อ 1 USD)', fxRatePh: 'เช่น 36.00', fxFetchBtn: 'ดึงอัตราปัจจุบัน',
      fxShowChkLbl: 'แสดงยอดเทียบเงินบาท (≈ ฿) ในหน้านี้',
      fxFetching: 'กำลังดึงอัตราแลกเปลี่ยน…', fxFromYahoo: 'อัตราจาก Yahoo Finance (THB=X) · เมื่อสักครู่',
      fxStaleCached: 'ดึงสดไม่ได้ — ใช้อัตราที่บันทึกไว้ ({age})', fxFetchFail: 'ดึงอัตโนมัติไม่ได้ตอนนี้ — กรอกอัตราแลกเปลี่ยนเองด้านบน',
      perBtcAtRate: ' ต่อ BTC (ตามอัตราที่ตั้งไว้)',
      lightTitle: 'ไฟจราจร', detailsSummary: 'ดูรายละเอียดทางเทคนิค (ไม่ต้องเข้าใจก็ได้)',
      fngTitle: 'ดัชนีความกลัว-ความโลภ (Fear &amp; Greed)',
      loadingDefault: 'กำลังโหลด…', fngExtFear: 'กลัวสุดขีด', fngNeutral: 'กลาง', fngExtGreed: 'โลภสุดขีด',
      fngLiveSrc: 'ข้อมูลสด · Alternative.me', fngStaleSrc: 'ดึงสดไม่ได้ — ใช้ค่าที่บันทึกไว้ ({age})',
      fngFail: 'ดึงข้อมูลไม่ได้ตอนนี้', fngRetryLater: 'ลองรีเฟรชหน้านี้อีกครั้งภายหลัง',
      fngClassExtFear: 'กลัวสุดขีด', fngClassFear: 'กลัว', fngClassNeutral: 'เป็นกลาง', fngClassGreed: 'โลภ', fngClassExtGreed: 'โลภสุดขีด',
      chartTitle: 'กราฟราคา', tf1m: '1เดือน', tf3m: '3เดือน', tf6m: '6เดือน', tf1y: '1ปี',
      tgMa20: 'เฉลี่ย 20', tgMa50: 'เฉลี่ย 50',
      chartCapUp: 'แท่งขึ้น', chartCapDown: 'แท่งลง', chartCapMa20: 'เฉลี่ย 20 วัน', chartCapMa50: 'เฉลี่ย 50 วัน', chartCapTap: 'แตะบนกราฟเพื่อดูราคาแต่ละวัน',
      legendOpen: 'เปิด', legendHigh: 'สูง', legendLow: 'ต่ำ', legendClose: 'ปิด',
      step2Title: 'ถ้าจะซื้อ ควรใส่เงินเท่าไร ตั้งขายที่ไหน',
      lblCapital: 'เงินลงทุนทั้งพอร์ต (USD)', phCapital: 'เช่น 10000',
      lblRiskPct: 'ยอมเสี่ยงต่อไม้', unitPctPortfolio: '(% ของพอร์ต)',
      lblEntry: 'ราคาเข้าซื้อ (USD)', phEntry: '= ราคาตอนนี้',
      lblStop: 'ราคาตัดขาดทุน (Stop)', phStop: 'แนะนำอัตโนมัติ',
      lblComm: 'ค่าคอมฯ', unitPctPerTrade: '(% ต่อครั้ง)',
      calcBtn: 'คำนวณ', saveToPfBtn: 'บันทึกเข้าพอร์ต', savedToPfDone: 'บันทึกแล้ว',
      checklistTitle: 'ตรวจก่อนเข้าไม้ — ควรซื้อไหม?',
      chkNoLeverage: 'ยืนยันว่าเทรด spot เท่านั้น ไม่ใช้เลเวอเรจ/มาร์จิ้น', ynYes: 'ใช่', ynNo: 'ยัง', checkBtn: 'ตรวจเช็กลิสต์',
      driveTitle: 'สำรองพอร์ต + สมุดเทรดขึ้น Google Drive',
      driveConnectBtn: 'เชื่อมต่อ Google Drive', driveConnectedBtn: 'เชื่อมต่อ Google Drive แล้ว',
      pfTitle: 'พอร์ต Bitcoin ของฉัน',
      lblPfQty: 'จำนวน BTC', lblPfCost: 'ราคาต้นทุน/BTC', pfAddBtn: '+ เพิ่มเข้าพอร์ต',
      pfEmptyDefault: 'ยังไม่มี BTC ในพอร์ต',
      pfEmptyAlt: 'ยังไม่มี BTC ในพอร์ต — คำนวณด้านบนแล้วกด "บันทึกเข้าพอร์ต"',
      pfColQty: 'จำนวน BTC', pfColCost: 'ต้นทุน/BTC', pfColCur: 'ราคาปัจจุบัน', pfColPl: 'กำไร/ขาดทุน', pfPricePh: 'ราคา',
      pfSellBtnTitle: 'เช็กควรขาย?', pfSellBtn: 'ควรขาย?', pfDelTitle: 'ลบ',
      alertPfInvalid: 'กรอกจำนวน BTC และราคาต้นทุนให้ถูกต้อง',
      jTitle: 'สมุดเทรด + สถิติ (ดู "ฝีมือ" ตัวเอง)',
      lblJEntry: 'ราคาเข้า', lblJExit: 'ราคาออก', lblJQty: 'จำนวน BTC', jAddBtn: '+ บันทึก',
      alertJInvalid: 'กรอกราคาเข้า ราคาออก และจำนวน BTC ให้ครบ',
      jEmpty: 'ยังไม่มีไม้ที่บันทึก — ปิดไม้แล้วบันทึกทุกครั้ง จะเห็นสถิติจริงของตัวเอง',
      jStatCount: 'จำนวนไม้', jStatWinRate: 'อัตราชนะ', jStatTotalPl: 'กำไร/ขาดทุนรวม', jStatExpectancy: 'คาดหวัง/ไม้',
      jColEntry: 'เข้า', jColExit: 'ออก', jColQty: 'จำนวน BTC', jColResult: 'ผล',
      eTitle: 'ระบบเทรดของคุณ "กำไรระยะยาว" ไหม?',
      lblEWin: 'อัตราชนะ', unitPctWin: '(% ของไม้ที่ชนะ)', lblEWinR: 'กำไรเฉลี่ยตอนชนะ', unitRMultiple: '(เท่าของความเสี่ยง R)', lblELossR: 'ขาดทุนเฉลี่ยตอนแพ้',
      eExpectancyLine: 'ค่าคาดหวังต่อไม้ ≈ <b>{sign}{exp} R</b> (ถ้าเสี่ยงไม้ละ $1,000 ≈ {sign2}{usdAmt} ต่อไม้โดยเฉลี่ย)<br><span style="font-weight:500">ต้องชนะอย่างน้อย ~{be}% ถึงจะเสมอตัวที่ R นี้</span>',
      eGoTitle: 'ได้เปรียบระยะยาว', eGoNote: 'ถ้าทำตามวินัยสม่ำเสมอ (คุมความเสี่ยงเท่ากันทุกไม้) มีโอกาสกำไรระยะยาว',
      eWarnTitle: 'แทบเสมอตัว', eWarnNote: 'หักค่าคอมฯแล้วอาจขาดทุน — ต้องเพิ่มกำไรตอนชนะ หรือลดขาดทุนตอนแพ้',
      eNoTitle: 'ขาดทุนระยะยาว', eNoNote: 'ถึงชนะบ่อยก็ไม่พอ — ต้อง "ปล่อยกำไรให้ยาว ตัดขาดทุนให้ไว" (เพิ่ม R ตอนชนะ)',
      dcaTitle: 'ออม Bitcoin แบบ DCA (ทางเลือกความเสี่ยงต่ำกว่า)',
      lblDcaPmt: 'ออมเดือนละ', lblDcaStart: 'ราคา BTC เริ่มต้น', phDcaStart: 'รอราคาจากขั้นที่ 1',
      lblDcaYears: 'วางแผนล่วงหน้า', lblDcaCagr: 'สมมติราคาโตเฉลี่ย', dcaCalcBtn: 'คำนวณแผน',
      dcaContribLabel: 'เงินที่ลงทั้งหมด', dcaQtyLabel: 'BTC สะสม', dcaValueLabel: 'มูลค่าประมาณสิ้นแผน', dcaGainLabel: 'กำไร/ขาดทุนจากราคาที่เปลี่ยน',
      dcaCapTotal: 'มูลค่ารวม', dcaCapContrib: 'เงินที่ใส่ (ต้นทุน)', dcaYrSummary: 'ดูตารางรายปี',
      alertDcaStart: 'กรอกราคา BTC เริ่มต้นให้ถูกต้อง (หรือรอราคาจากขั้นที่ 1 โหลดก่อน แล้วลองอีกครั้ง)', alertDcaPmt: 'กรอกเงินออมต่อเดือนให้ถูกต้อง',
      dcaYrCol: 'สิ้นปีที่ {n}', dcaYrColContrib: 'เงินที่ใส่', dcaYrColQty: 'BTC สะสม', dcaYrColVal: 'มูลค่า',
      dcaYrHdYear: 'สิ้นปีที่', dcaYrHdContrib: 'เงินที่ใส่', dcaYrHdQty: 'BTC สะสม', dcaYrHdVal: 'มูลค่า',
      realityTitle: 'อ่านก่อนเอาเงินมาลงทุนใน Bitcoin (สำคัญมาก)',
      reality1: 'ลงทุน <b>เฉพาะเงินที่ไม่ต้องใช้อย่างน้อย 3–5 ปี</b> และรับได้ถ้าหายทั้งหมด',
      reality2: 'มี <b>เงินสำรองฉุกเฉิน 3–6 เดือน</b> ก่อนเริ่มเสมอ',
      reality3: '<b>ห้ามเด็ดขาด</b>: เลเวอเรจ/มาร์จิ้น/ฟิวเจอร์ส — เทรด spot เท่านั้น เลเวอเรจคริปโตเป็นสาเหตุอันดับต้นที่ทำให้พอร์ตถูกบังคับปิดสถานะ (liquidation) จากความผันผวนระยะสั้น นักเทรดเลเวอเรจคริปโตส่วนใหญ่ขาดทุน',
      reality4: 'สูตรคุมความเสี่ยง: <b>ขนาดไม้ = (เงินทุน × %ความเสี่ยง) ÷ ระยะห่างจากจุดตัดขาดทุน</b> — ใช้เครื่องคำนวณขั้นที่ 2 ด้านบนแทนการเดา',
      reality5: 'BTC ผันผวนสูงกว่าดัชนีหุ้นกว้าง ~3-4 เท่า — เสี่ยงต่อไม้ 0.5–1% (ไม่ใช่ 2% แบบหุ้น) และ stop ควรกว้างกว่าหุ้นตามสัดส่วน',
      reality6: 'ขายทำกำไรเป็น steps (TP1/TP2/TP3, ทยอยขายบางส่วน) แทนขายหมดทีเดียวหรือถือยาวไม่มีแผน',
      realityCtaText: 'ถ้าไม่อยากจับจังหวะเข้า-ออกเลย ทางเลือกความเสี่ยงต่ำกว่าคือ', realityCtaDca: 'ทยอยซื้อสะสม (DCA)',
      realityCtaMid: ' — ใช้การ์ด "ออม Bitcoin แบบ DCA" ด้านบน หรือกระจายไปสินทรัพย์อื่นด้วย',
      realityGoldLink: 'ทองคำ →', realityOr: 'หรือ', realityFundLink: 'กองทุน S&amp;P500 →',
      /* วิเคราะห์/ไฟจราจร */
      ageJustNow: 'เมื่อสักครู่', ageMinAgo: '{n} นาทีก่อน', ageHrAgo: '{n} ชม.ก่อน', ageDaysAgo: '{n} วันก่อน',
      proCheapRange: 'ราคาอยู่ช่วงถูกเทียบ 3 เดือน', conExpRange: 'ราคาอยู่ช่วงแพงเทียบ 3 เดือน',
      proRsiLow: 'แรงขายเริ่มคลาย (RSI ต่ำ กำลังฟื้น)', conRsiHigh: 'ราคาร้อนแรงเกินไป (RSI สูง เสี่ยงย่อ)',
      proMomUp: 'โมเมนตัมเริ่มกลับเป็นบวก', conMomDn: 'โมเมนตัมเริ่มอ่อนลง',
      proUptrend: 'ยังอยู่ในแนวโน้มขึ้น', conDowntrend: 'อยู่ใต้เส้นแนวโน้ม (ขาลง/พักตัว)',
      proBbLow: 'ราคาแตะกรอบล่าง (มักเป็นจังหวะเด้ง)', conBbHigh: 'ราคาชนกรอบบน',
      verdictGreen: 'น่าสนใจ — ลองพิจารณา', verdictRed: 'ระวัง — ยังไม่ใช่จังหวะ', verdictYellow: 'รอก่อน — ยังไม่มีจังหวะเด่น',
      whyNeutral: 'ราคาอยู่กลางกรอบ ยังไม่มีสัญญาณชัด',
      simpleGreen: 'น่าสนใจ — ลองพิจารณา', simpleRed: 'ระวัง — ราคาค่อนข้างแพง', simpleYellow: 'รอก่อน — ราคากลางกรอบ',
      simpleWhyCheap: 'ราคาอยู่ค่อนไปทางถูกของรอบ (~{pct}% ของช่วง ต่ำ→สูง)',
      simpleWhyExp: 'ราคาอยู่ค่อนไปทางแพงของรอบ (~{pct}% ของช่วง ต่ำ→สูง)',
      simpleWhyMid: 'ราคาอยู่กลางกรอบ (~{pct}% ของช่วง ต่ำ→สูง)',
      riskErrStop: 'ราคาตัดขาดทุนต้องต่ำกว่าราคาเข้าซื้อ', riskCapLimitedNote: 'จำกัดจำนวนตามเงินที่มี (ทุนไม่พอซื้อเท่าที่ความเสี่ยงอนุญาต)',
      demoSrcBadge: 'ข้อมูลตัวอย่าง — ไม่ใช่ราคาจริง (ไว้ฝึกอ่านกราฟ)', pasteSrcBadge: 'ราคาที่วางเอง · {n} วัน',
      realPriceLabel: 'ราคาจริง', realSrcBadge: '{src} · {stale} · {n} วัน', staleLastPrice: 'ราคาล่าสุด {age}',
      chartLibFail: 'โหลดไลบรารีกราฟไม่ได้ (ลองออนไลน์แล้วรีเฟรช) — ส่วนไฟจราจร/คำนวณเงินยังใช้ได้',
      detEma20: 'เส้นเฉลี่ย 20 วัน (EMA20)', detEma50: 'เส้นเฉลี่ย 50 วัน (EMA50)', detRsi: 'RSI (14)', detMacdHist: 'MACD histogram',
      detBbUpper: 'กรอบบน (Bollinger)', detBbLower: 'กรอบล่าง (Bollinger)', detAtr: 'ATR (ความผันผวน)',
      detSupport: 'แนวรับล่าสุด', detResistance: 'แนวต้านล่าสุด', detAdx: 'ความแรงแนวโน้ม (ADX 14)', detPsar: 'จุดตัดขาดทุนตาม (Parabolic SAR)',
      adxStrong: 'แข็งแรง', adxWeak: 'อ่อน', psarUp: 'เทรนด์ขึ้น', psarDown: 'เทรนด์ลง',
      errEnterPriceFirst: 'กรอกอย่างน้อย "ราคาตอนนี้" ก่อนนะครับ',
      grayVerdictNeedRange: 'กรอกราคาสูง/ต่ำของรอบ เพื่อประเมินถูก-แพง',
      grayWhyNeedRange: 'หรือกด "ดูกราฟตัวอย่าง (ฝึกอ่าน)" เพื่อลองเล่นกราฟ — ตอนนี้ทำได้เฉพาะคำนวณเงินด้านล่าง',
      fetchingSym: 'กำลังดึงข้อมูล {sym}…', updatedAt: 'อัปเดต {time}', directSourceLabel: 'ตรง',
      priceLiveFrom: 'ราคาล่าสุด {price} USD · {src} · {time}',
      priceLiveFromSeries: 'ราคา {sym} สดจาก {src} · กราฟย้อนหลัง {n} วัน',
      staleUseSaved: 'แหล่งข้อมูลสดใช้ไม่ได้ · ใช้ข้อมูลย้อนหลังที่บันทึกไว้ ({age}) · {n} วัน',
      historicalFromSrc: 'ขณะนี้ใช้ราคาย้อนหลังจาก {src} · {n} วัน',
      fetchFail: 'ดึงราคาไม่ได้ตอนนี้ — ตรวจการเชื่อมต่อข้อมูลตลาด',
      demoStatus: 'กำลังแสดง "ข้อมูลตัวอย่าง" (ไม่ใช่ราคาจริง) — ไว้ลองเล่นกราฟและฝึกอ่าน',
      pasteErrShort: 'วางราคาปิดอย่างน้อย 5 วันก่อนนะครับ', pasteOk: 'ใช้ราคาที่วางแล้ว ({n} วัน)',
      errNeedEntry: 'กรอกราคาเข้าซื้อ (หรือราคาตอนนี้) ก่อน',
      calcQtyLine: 'ควรซื้อได้ประมาณ <b>{qty} BTC</b> (≈ {sats} sats) ใช้เงิน ≈ <b>{cost}</b>',
      kvIfWrong: 'ถ้าผิดทาง (แตะ Stop) เสียไม่เกิน', kvStop: 'ราคาตัดขาดทุน (Stop)', kvBreakeven: 'ราคาคุ้มทุน (รวมค่าคอมฯ ไป-กลับ)',
      kvRr: 'ความคุ้ม (กำไรคาดหวัง : ความเสี่ยง) ถึงแนวต้าน',
      tpChip1: 'ทยอยขายไม้ 1 (TP1): {v}', tpChip2: 'ไม้ 2 (TP2): {v}', tpChip3: 'ไม้ 3 (TP3, ที่เหลือ trail stop): {v}',
      pfSellFetching: 'กำลังดึงราคา {sym}…',
      sellDetailPrice: 'ราคาล่าสุด {price}{stale} · ต้นทุน {cost} · {plWord}{pl} ({sign}{pct}%)',
      staleSaved: ' (บันทึกไว้ {age})', profitWord: 'กำไร ', lossWord: 'ขาดทุน ',
      sellFetchFail: 'ดึงราคา {sym} ไม่ได้ตอนนี้ — ลองใหม่อีกครั้ง หรือกรอกราคาปัจจุบันเองในช่อง',
      sellVerdictSar: 'พิจารณาขาย — สัญญาณเทรนด์กลับตัว (SAR พลิกลง)',
      sellVerdictTrend: 'พิจารณาขาย/ตัดขาดทุน — ราคาหลุดแนวโน้ม (ต่ำกว่าเส้นค่าเฉลี่ย)',
      sellVerdictRsi: 'พิจารณาล็อกกำไรบางส่วน — RSI สูง ราคาร้อนแรง อาจย่อ',
      sellVerdictResist: 'ใกล้แนวต้าน — พิจารณาล็อกกำไรบางส่วน',
      sellVerdictGo: 'ยังอยู่ในแนวโน้มขึ้น — ถือต่อได้ เลื่อนจุดตัดขาดทุนตามแนวด้านล่าง',
      lvSarLabel: 'แนวตัดขาดทุนตามเทรนด์ (SAR)', lvSarReasonNoData: 'ข้อมูลไม่พอคำนวณ (ต้องมีประวัติราคาอย่างน้อย ~3 วัน)',
      lvSarReasonUp: 'ถ้าราคาปิดหลุดต่ำกว่า {v} ถือว่าเทรนด์ขาขึ้นเริ่มกลับตัว', lvSarReasonDown: 'ราคาหลุดแนวนี้ไปแล้ว (SAR พลิกลง) — เป็นสัญญาณเตือนที่ชัดที่สุด',
      lvStopLabel: 'จุดตัดขาดทุนตามความเสี่ยง (ATR/แนวรับ)', lvStopReasonNoData: 'ข้อมูลไม่พอคำนวณ',
      lvStopReason: 'กันขาดทุนหนักถ้าราคาหลุดแนวรับหรือผันผวนเกินค่าเฉลี่ย', lvStopAtrSuffix: ' (ATR ≈ {v})',
      lvEma20Label: 'เส้นค่าเฉลี่ย 20 วัน (สัญญาณเตือนแรก)', lvEma20ReasonNoData: 'ข้อมูลไม่พอคำนวณ',
      lvEma20Reason: 'หลุดเส้นนี้มักเป็นสัญญาณเริ่มอ่อนตัว — ยังไม่ใช่จุดตัดขาดทุนหลัก แต่ควรเริ่มระวัง',
      lvResistLabel: 'แนวต้าน (จุดพิจารณาล็อกกำไรบางส่วน)', lvResistReasonNoData: 'ข้อมูลไม่พอคำนวณ',
      lvResistReason: 'ราคามักเจอแรงขายทำกำไรบริเวณนี้ พิจารณาขายบางส่วนหรือเลื่อนจุดตัดขาดทุนตามเพื่อป้องกันกำไร',
      chkTrendUp: 'อยู่ในแนวโน้มขึ้น (ราคาเหนือเส้นเฉลี่ย)', chkTrendDn: 'ยังไม่อยู่ในแนวโน้มขึ้น (ราคาใต้เส้นเฉลี่ย)',
      chkAdxSuffix: ' · ADX {v} {label}', chkAdxStrong: 'เทรนด์แข็งแรง', chkAdxWeak: 'เทรนด์อ่อน ควรระวัง',
      chkNoChase: 'ไม่ไล่ราคา (ห่างเส้นเฉลี่ย 20 ไม่เกิน 5%)', chkChasing: 'กำลังไล่ราคา (สูงกว่าเส้นเฉลี่ย 20 เกิน 5%)',
      chkTrendNeedData: 'แนวโน้ม/การไล่ราคา: ต้องมีข้อมูลกราฟก่อน (กด "ดึงราคา" หรือ "ดูกราฟตัวอย่าง")',
      chkRsiOk: 'ไม่ร้อนแรงเกิน (RSI {v})', chkRsiHot: 'ร้อนแรงเกินไป (RSI {v} ≥ 70) เสี่ยงย่อ', chkRsiNeedData: 'RSI: ต้องมีข้อมูลกราฟก่อน',
      chkStopSet: 'ตั้งจุดตัดขาดทุน (Stop) แล้ว', chkStopUnset: 'ยังไม่ตั้งจุดตัดขาดทุน — กด "คำนวณ" ในขั้นที่ 2 ก่อน',
      chkRiskOk: 'เสี่ยงต่อไม้ ≤ 1% ({v}%) — เหมาะกับความผันผวนของคริปโต',
      chkRiskHigh: 'เสี่ยงต่อไม้สูงไปสำหรับคริปโต ({v}) — คริปโตผันผวนกว่าหุ้นทั่วไป ~3-4 เท่า ควร ≤ 1%',
      chkRrOk: 'กำไรคาดหวัง:เสี่ยง ≥ 2:1 ({v}:1)', chkRrLow: 'กำไร:เสี่ยงน้อยไป ({v}:1) — ควร ≥ 2:1',
      chkRrNeedData: 'กำไร:เสี่ยง: ต้องมีแนวต้านจากกราฟ + ตั้ง Stop ก่อน',
      chkLeverageYes: 'ไม่ใช้เลเวอเรจ/มาร์จิ้น (เทรด spot เท่านั้น) ยืนยันแล้ว',
      chkLeverageNo: 'กำลังใช้เลเวอเรจ/มาร์จิ้น — เสี่ยงถูกบังคับปิดสถานะ (liquidation) จากความผันผวนระยะสั้น แนะนำเทรด spot เท่านั้น',
      chkLeverageUnknown: 'ยืนยันก่อนว่าเทรด spot ไม่ใช้เลเวอเรจ/มาร์จิ้น (กดปุ่มด้านบน)',
      checklistFail: 'ยังไม่ควรเข้า — ติด {n} ข้อ ควรแก้ให้ครบก่อนซื้อ',
      checklistUnknown: 'ข้อมูลไม่พอประเมินครบ — กด "ประเมิน"/"ดึงราคา" แล้ว "คำนวณ" และตอบคำถามด้านบนก่อน',
      checklistGo: 'เข้าได้ตามแผน — ผ่านครบทุกข้อ (แต่ยังไม่การันตีกำไร ทำตามแผนและตัดขาดทุนเสมอ)',
      eFillErr: 'กรอกตัวเลขให้ครบ (อัตราชนะ 0–100%, กำไร/ขาดทุนเป็นเท่าของ R)',
      driveAutoFail: 'เชื่อมต่ออัตโนมัติไม่สำเร็จ (อาจเพราะเบราว์เซอร์บล็อก cookie ข้ามโดเมน) — กดปุ่มเชื่อมต่ออีกครั้ง',
      driveConnectFail: 'เชื่อมต่อไม่สำเร็จ: {err}', driveLoadingGis: 'กำลังโหลด Google Identity Services… รออีก 2-3 วิแล้วลองใหม่',
      driveRequesting: 'กำลังขอสิทธิ์เชื่อมต่อ…', driveErrSearchFolder: 'ค้นหาโฟลเดอร์ไม่สำเร็จ ({code})',
      driveErrCreateFolder: 'สร้างโฟลเดอร์ไม่สำเร็จ ({code})', driveErrSearchFile: 'ค้นหาไฟล์ไม่สำเร็จ ({code})',
      driveErrDownload: 'ดาวน์โหลดไม่สำเร็จ ({code})', driveErrUpload: 'บันทึกขึ้น Drive ไม่สำเร็จ ({code})',
      driveSyncing: 'กำลังซิงก์…', driveSyncedAt: 'ซิงก์กับ Google Drive แล้ว · {time}', driveLastSync: 'ซิงก์ล่าสุด {time}',
      driveSessionExpired: 'เซสชันหมดอายุ — กดปุ่มเชื่อมต่อ Drive อีกครั้ง', driveSyncFailed: 'ซิงก์ไม่สำเร็จ: {err}'
    },
    en: {
      navInvest: 'Investing', pageTitle: 'Bitcoin — Entry/Exit Helper + Savings',
      step1Title: 'Current BTC-USD price',
      lblPriceNow: 'Current price (USD)', phPriceNow: 'e.g. 65000',
      lblHi: 'Cycle high price', lblLo: 'Cycle low price', ph3mo: '3-month range',
      marketModeHist: 'Data mode: Historical', marketModeLive: 'Data mode: Live / Real-time', marketModeFallback: 'Data mode: Fallback / Historical',
      marketMetaDefault: 'Set a live data source under "Market data settings"',
      marketMetaHistoricalUse: 'Using Yahoo for historical charts',
      marketMetaFallback: "Live data source isn't reachable · using historical price as fallback",
      marketRefreshBtn: '↻ Refresh', marketSettingsBtn: '⚙️ Market data settings',
      marketSettingsTitle: 'Live market data',
      marketProviderLbl: 'Data source', marketProviderGateway: 'Tanot Data Gateway (recommended)', marketProviderTwelve: 'Twelve Data', marketProviderYahoo: 'Yahoo / Historical',
      marketGatewayLbl: 'Gateway URL', marketApiKeyNote: '(stored locally only)', marketApiKeyPh: 'Enter if you have an API key',
      marketIntervalLbl: 'Refresh every', marketInterval5: '5 seconds', marketInterval10: '10 seconds', marketInterval30: '30 seconds',
      marketSaveBtn: 'Save settings', marketClearBtn: 'Clear API key',
      marketSavedMsg: 'Settings saved · data will refresh at the set interval', marketApiKeyCleared: 'API key cleared from this device',
      updatedAt: 'updated {time}', directSourceLabel: 'Direct',
      fetchBtn: 'Try fetching price', analyzeBtn: 'Assess it for me', demoBtn: 'View sample chart (practice)',
      pasteSummary: 'Paste historical prices yourself (optional)', pasteHint: 'Paste several days of closing prices, separated by spaces/lines/commas (oldest→newest)', pasteBtn: 'Use this price',
      fxSummary: 'Convert to Thai baht (optional)',
      fxRateLbl: 'Exchange rate', fxRateUnit: '(THB per 1 USD)', fxRatePh: 'e.g. 36.00', fxFetchBtn: 'Fetch current rate',
      fxShowChkLbl: 'Show amounts converted to baht (≈ ฿) on this page',
      fxFetching: 'Fetching exchange rate…', fxFromYahoo: 'Rate from Yahoo Finance (THB=X) · just now',
      fxStaleCached: 'Live fetch failed — using the saved rate ({age})', fxFetchFail: "Couldn't auto-fetch right now — enter the exchange rate yourself above",
      perBtcAtRate: ' per BTC (at the rate you set)',
      lightTitle: 'Traffic Light', detailsSummary: "See technical details (you don't need to understand them)",
      fngTitle: 'Fear &amp; Greed Index',
      loadingDefault: 'Loading…', fngExtFear: 'Extreme Fear', fngNeutral: 'Neutral', fngExtGreed: 'Extreme Greed',
      fngLiveSrc: 'Live data · Alternative.me', fngStaleSrc: 'Live fetch failed — using saved value ({age})',
      fngFail: "Couldn't fetch data right now", fngRetryLater: 'Try refreshing this page again later',
      fngClassExtFear: 'Extreme Fear', fngClassFear: 'Fear', fngClassNeutral: 'Neutral', fngClassGreed: 'Greed', fngClassExtGreed: 'Extreme Greed',
      chartTitle: 'Price Chart', tf1m: '1M', tf3m: '3M', tf6m: '6M', tf1y: '1Y',
      tgMa20: 'MA 20', tgMa50: 'MA 50',
      chartCapUp: 'Up candle', chartCapDown: 'Down candle', chartCapMa20: '20-day average', chartCapMa50: '50-day average', chartCapTap: 'Tap the chart to see each day’s price',
      legendOpen: 'Open', legendHigh: 'High', legendLow: 'Low', legendClose: 'Close',
      step2Title: 'If you buy, how much should you put in, and where should you sell',
      lblCapital: 'Total capital (USD)', phCapital: 'e.g. 10000',
      lblRiskPct: 'Risk tolerance per trade', unitPctPortfolio: '(% of portfolio)',
      lblEntry: 'Entry price (USD)', phEntry: '= current price',
      lblStop: 'Stop-loss price', phStop: 'Auto-suggested',
      lblComm: 'Commission', unitPctPerTrade: '(% per trade)',
      calcBtn: 'Calculate', saveToPfBtn: 'Save to portfolio', savedToPfDone: 'Saved',
      checklistTitle: 'Pre-trade check — should you buy?',
      chkNoLeverage: 'Confirm you only trade spot, no leverage/margin', ynYes: 'Yes', ynNo: 'Not yet', checkBtn: 'Check the checklist',
      driveTitle: 'Back up portfolio + trade journal to Google Drive',
      driveConnectBtn: 'Connect Google Drive', driveConnectedBtn: 'Google Drive connected',
      pfTitle: 'My Bitcoin Portfolio',
      lblPfQty: 'BTC amount', lblPfCost: 'Cost per BTC', pfAddBtn: '+ Add to portfolio',
      pfEmptyDefault: 'No BTC in your portfolio yet',
      pfEmptyAlt: 'No BTC in your portfolio yet — calculate above then press "Save to portfolio"',
      pfColQty: 'BTC amount', pfColCost: 'Cost/BTC', pfColCur: 'Current price', pfColPl: 'Profit/Loss', pfPricePh: 'Price',
      pfSellBtnTitle: 'Check should I sell?', pfSellBtn: 'Should I sell?', pfDelTitle: 'Delete',
      alertPfInvalid: 'Enter a valid BTC amount and cost price',
      jTitle: 'Trade Journal + Stats (see your own "skill")',
      lblJEntry: 'Entry price', lblJExit: 'Exit price', lblJQty: 'BTC amount', jAddBtn: '+ Log',
      alertJInvalid: 'Enter the entry price, exit price, and BTC amount completely',
      jEmpty: 'No trades logged yet — log every closed trade to see your real stats',
      jStatCount: 'Trades', jStatWinRate: 'Win rate', jStatTotalPl: 'Total profit/loss', jStatExpectancy: 'Expectancy/trade',
      jColEntry: 'Entry', jColExit: 'Exit', jColQty: 'BTC amount', jColResult: 'Result',
      eTitle: 'Is your trading system "profitable long-term"?',
      lblEWin: 'Win rate', unitPctWin: '(% of winning trades)', lblEWinR: 'Average win', unitRMultiple: '(multiple of risk R)', lblELossR: 'Average loss',
      eFillErr: 'Fill in all the numbers (win rate 0–100%, profit/loss as a multiple of R)',
      eExpectancyLine: 'Expected value per trade ≈ <b>{sign}{exp} R</b> (if risking $1,000 per trade ≈ {sign2}{usdAmt} per trade on average)<br><span style="font-weight:500">You need to win at least ~{be}% to break even at this R</span>',
      eGoTitle: 'Profitable long-term', eGoNote: 'If you stick to discipline consistently (risking the same amount every trade), there is a real chance of long-term profit',
      eWarnTitle: 'Nearly break-even', eWarnNote: 'After commissions this may actually be a loss — you need bigger wins, or smaller losses',
      eNoTitle: 'Loses money long-term', eNoNote: 'Even winning often isn\'t enough — you need to "let profits run, cut losses fast" (increase R when you win)',
      dcaTitle: 'Bitcoin DCA Savings Plan (a lower-risk alternative)',
      lblDcaPmt: 'Monthly savings', lblDcaStart: 'Starting BTC price', phDcaStart: 'Waiting for price from step 1',
      lblDcaYears: 'Plan ahead', lblDcaCagr: 'Assumed average growth', dcaCalcBtn: 'Calculate plan',
      dcaContribLabel: 'Total contributed', dcaQtyLabel: 'BTC accumulated', dcaValueLabel: 'Estimated value at plan end', dcaGainLabel: 'Gain/loss from price change',
      dcaCapTotal: 'Total value', dcaCapContrib: 'Amount contributed (cost)', dcaYrSummary: 'View year-by-year table',
      alertDcaStart: 'Enter a valid starting BTC price (or wait for the price from step 1 to load, then try again)', alertDcaPmt: 'Enter a valid monthly savings amount',
      dcaYrCol: 'End of year {n}', dcaYrColContrib: 'Contributed', dcaYrColQty: 'BTC accumulated', dcaYrColVal: 'Value',
      dcaYrHdYear: 'End of year', dcaYrHdContrib: 'Contributed', dcaYrHdQty: 'BTC accumulated', dcaYrHdVal: 'Value',
      realityTitle: 'Read before putting money into Bitcoin (very important)',
      reality1: 'Invest <b>only money you won\'t need for at least 3–5 years</b> and can accept losing entirely',
      reality2: 'Have a <b>3–6 month emergency fund</b> before you ever start',
      reality3: '<b>Absolutely never</b>: leverage/margin/futures — trade spot only. Crypto leverage is a leading cause of accounts being force-liquidated by short-term volatility; most leveraged crypto traders lose money',
      reality4: 'Risk-sizing formula: <b>position size = (capital × %risk) ÷ distance to stop-loss</b> — use the step-2 calculator above instead of guessing',
      reality5: 'BTC is ~3-4x more volatile than a broad stock index — risk 0.5–1% per trade (not 2% like stocks), and the stop should be proportionally wider than for stocks',
      reality6: 'Take profit in steps (TP1/TP2/TP3, sell portions gradually) instead of selling everything at once or holding indefinitely with no plan',
      realityCtaText: "If you'd rather not time entries and exits at all, a lower-risk alternative is", realityCtaDca: 'buying gradually (DCA)',
      realityCtaMid: ' — use the "Bitcoin DCA Savings" card above, or diversify into other assets with',
      realityGoldLink: 'Gold →', realityOr: 'or', realityFundLink: 'S&amp;P500 fund →',
      /* วิเคราะห์/ไฟจราจร */
      ageJustNow: 'just now', ageMinAgo: '{n} min ago', ageHrAgo: '{n} hr ago', ageDaysAgo: '{n} days ago',
      proCheapRange: 'Price is in the cheap zone vs. the last 3 months', conExpRange: 'Price is in the expensive zone vs. the last 3 months',
      proRsiLow: 'Selling pressure easing (RSI low, recovering)', conRsiHigh: 'Price is overheated (RSI high, risk of a pullback)',
      proMomUp: 'Momentum is turning positive', conMomDn: 'Momentum is weakening',
      proUptrend: 'Still in an uptrend', conDowntrend: 'Below the trend line (downtrend/consolidation)',
      proBbLow: 'Price is touching the lower band (often a bounce zone)', conBbHigh: 'Price is hitting the upper band',
      verdictGreen: 'Interesting — worth considering', verdictRed: 'Careful — not the right moment yet', verdictYellow: 'Wait — no standout opportunity yet',
      whyNeutral: 'Price is in the middle of the range, no clear signal yet',
      simpleGreen: 'Interesting — worth considering', simpleRed: 'Careful — price is fairly expensive', simpleYellow: 'Wait — price is in the middle of the range',
      simpleWhyCheap: 'Price is toward the cheap end of the range (~{pct}% of the low→high span)',
      simpleWhyExp: 'Price is toward the expensive end of the range (~{pct}% of the low→high span)',
      simpleWhyMid: 'Price is in the middle of the range (~{pct}% of the low→high span)',
      riskErrStop: 'The stop-loss price must be below the entry price', riskCapLimitedNote: 'Limited by available funds (capital is not enough to buy the full amount the risk setting would allow)',
      demoSrcBadge: 'Sample data — not a real price (for chart-reading practice)', pasteSrcBadge: 'Manually pasted price · {n} days',
      realPriceLabel: 'Real price', realSrcBadge: '{src} · {stale} · {n} days', staleLastPrice: 'Latest price {age}',
      chartLibFail: "Couldn't load the chart library (try again online and refresh) — the traffic light/money calculator still work",
      detEma20: '20-day average (EMA20)', detEma50: '50-day average (EMA50)', detRsi: 'RSI (14)', detMacdHist: 'MACD histogram',
      detBbUpper: 'Upper band (Bollinger)', detBbLower: 'Lower band (Bollinger)', detAtr: 'ATR (volatility)',
      detSupport: 'Latest support', detResistance: 'Latest resistance', detAdx: 'Trend strength (ADX 14)', detPsar: 'Trailing stop (Parabolic SAR)',
      adxStrong: 'strong', adxWeak: 'weak', psarUp: 'uptrend', psarDown: 'downtrend',
      errEnterPriceFirst: 'Please enter at least the "current price" first',
      grayVerdictNeedRange: 'Enter the cycle high/low price to assess cheap vs. expensive',
      grayWhyNeedRange: 'Or press "View sample chart (practice)" to try the chart — for now only the money calculator below works',
      fetchingSym: 'Fetching {sym} data…',
      priceLiveFrom: 'Latest price {price} USD · {src} · {time}',
      priceLiveFromSeries: 'Live {sym} price from {src} · {n}-day historical chart',
      staleUseSaved: 'Live data source unavailable · using saved historical data ({age}) · {n} days',
      historicalFromSrc: 'Currently using historical price from {src} · {n} days',
      fetchFail: "Couldn't fetch the price right now — check your market data connection",
      demoStatus: 'Showing "sample data" (not a real price) — for practicing chart reading',
      pasteErrShort: 'Paste at least 5 days of closing prices first', pasteOk: 'Using the pasted price ({n} days)',
      errNeedEntry: 'Enter the entry price (or current price) first',
      calcQtyLine: 'You could buy about <b>{qty} BTC</b> (≈ {sats} sats) using ≈ <b>{cost}</b>',
      kvIfWrong: 'If wrong (hits Stop), you lose no more than', kvStop: 'Stop-loss price (Stop)', kvBreakeven: 'Break-even price (including round-trip commission)',
      kvRr: 'Reward:risk to resistance',
      tpChip1: 'Sell portion 1 (TP1): {v}', tpChip2: 'Portion 2 (TP2): {v}', tpChip3: 'Portion 3 (TP3, trail the rest): {v}',
      pfSellFetching: 'Fetching {sym} price…',
      sellDetailPrice: 'Latest price {price}{stale} · cost {cost} · {plWord}{pl} ({sign}{pct}%)',
      staleSaved: ' (saved {age})', profitWord: 'profit of ', lossWord: 'loss of ',
      sellFetchFail: "Couldn't fetch the {sym} price right now — try again, or enter the current price yourself in the field",
      sellVerdictSar: 'Consider selling — trend reversal signal (SAR flipped down)',
      sellVerdictTrend: 'Consider selling/cutting losses — price has broken the trend (below the moving average)',
      sellVerdictRsi: 'Consider locking in some profit — RSI is high, price is overheated, may pull back',
      sellVerdictResist: 'Near resistance — consider locking in some profit',
      sellVerdictGo: 'Still in an uptrend — you can keep holding, trail your stop along the line below',
      lvSarLabel: 'Trend-following stop (SAR)', lvSarReasonNoData: 'Not enough data to calculate (needs at least ~3 days of price history)',
      lvSarReasonUp: 'If the closing price breaks below {v}, the uptrend is considered to be reversing', lvSarReasonDown: 'Price has already broken this level (SAR flipped down) — the clearest warning signal',
      lvStopLabel: 'Risk-based stop-loss (ATR/support)', lvStopReasonNoData: 'Not enough data to calculate',
      lvStopReason: 'Protects against a heavy loss if the price breaks support or swings beyond the average', lvStopAtrSuffix: ' (ATR ≈ {v})',
      lvEma20Label: '20-day moving average (early warning signal)', lvEma20ReasonNoData: 'Not enough data to calculate',
      lvEma20Reason: 'Breaking below this line is often an early sign of weakening — not the main stop-loss, but worth watching',
      lvResistLabel: 'Resistance (a point to consider locking in some profit)', lvResistReasonNoData: 'Not enough data to calculate',
      lvResistReason: 'Price often meets profit-taking pressure around here — consider selling a portion or trailing your stop to protect gains',
      chkTrendUp: 'In an uptrend (price above the moving average)', chkTrendDn: 'Not yet in an uptrend (price below the moving average)',
      chkAdxSuffix: ' · ADX {v} {label}', chkAdxStrong: 'strong trend', chkAdxWeak: 'weak trend, be careful',
      chkNoChase: 'Not chasing the price (within 5% of the 20-day average)', chkChasing: 'Chasing the price (more than 5% above the 20-day average)',
      chkTrendNeedData: 'Trend/price-chasing: needs chart data first (press "Fetch price" or "View sample chart")',
      chkRsiOk: 'Not overheated (RSI {v})', chkRsiHot: 'Overheated (RSI {v} ≥ 70), risk of a pullback', chkRsiNeedData: 'RSI: needs chart data first',
      chkStopSet: 'Stop-loss (Stop) is set', chkStopUnset: 'Stop-loss not set yet — press "Calculate" in step 2 first',
      chkRiskOk: 'Risk per trade ≤ 1% ({v}%) — suits crypto volatility',
      chkRiskHigh: 'Risk per trade is too high for crypto ({v}) — crypto is ~3-4x more volatile than typical stocks, should be ≤ 1%',
      chkRrOk: 'Reward:risk ≥ 2:1 ({v}:1)', chkRrLow: 'Reward:risk too low ({v}:1) — should be ≥ 2:1',
      chkRrNeedData: 'Reward:risk: needs resistance from the chart + a Stop set first',
      chkLeverageYes: 'Confirmed: no leverage/margin (spot trading only)',
      chkLeverageNo: 'Currently using leverage/margin — risk of forced liquidation from short-term volatility; spot trading only is recommended',
      chkLeverageUnknown: 'Confirm first that you trade spot with no leverage/margin (press the button above)',
      checklistFail: 'Not ready to enter yet — {n} item(s) failed; fix them all before buying',
      checklistUnknown: 'Not enough information to fully assess — press "Assess"/"Fetch price" then "Calculate", and answer the questions above first',
      checklistGo: 'Ready to enter per plan — passed every item (still no profit guarantee — follow the plan and always cut losses)',
      driveAutoFail: 'Automatic connection failed (the browser may be blocking cross-domain cookies) — press the connect button again',
      driveConnectFail: 'Connection failed: {err}', driveLoadingGis: 'Loading Google Identity Services… wait a couple seconds and try again',
      driveRequesting: 'Requesting connection permission…', driveErrSearchFolder: 'Folder search failed ({code})',
      driveErrCreateFolder: 'Folder creation failed ({code})', driveErrSearchFile: 'File search failed ({code})',
      driveErrDownload: 'Download failed ({code})', driveErrUpload: 'Save to Drive failed ({code})',
      driveSyncing: 'Syncing…', driveSyncedAt: 'Synced with Google Drive · {time}', driveLastSync: 'Last synced {time}',
      driveSessionExpired: 'Session expired — press the connect Drive button again', driveSyncFailed: 'Sync failed: {err}'
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
    if (posRange < 0.35) { score += 1; pros.push(t('proCheapRange')); }
    else if (posRange > 0.75) { score -= 1; cons.push(t('conExpRange')); }
    if (isFinite(r)) {
      if (r < 38) { score += 1; pros.push(t('proRsiLow')); }
      else if (r > 70) { score -= 1; cons.push(t('conRsiHigh')); }
    }
    if (momUp) { score += 1; pros.push(t('proMomUp')); }
    else if (momDn) { score -= 1; cons.push(t('conMomDn')); }
    if (uptrend) { score += 1; pros.push(t('proUptrend')); }
    else { score -= 1; cons.push(t('conDowntrend')); }
    if (posBB < 0.2) { score += 0.5; pros.push(t('proBbLow')); }
    else if (posBB > 0.9) { score -= 0.5; cons.push(t('conBbHigh')); }

    var light, verdict;
    if (score >= 2) { light = 'green'; verdict = t('verdictGreen'); }
    else if (score <= -1) { light = 'red'; verdict = t('verdictRed'); }
    else { light = 'yellow'; verdict = t('verdictYellow'); }
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
    if (pos < 0.35) { light = 'green'; verdict = t('simpleGreen'); why = t('simpleWhyCheap', { pct: pct }); }
    else if (pos > 0.75) { light = 'red'; verdict = t('simpleRed'); why = t('simpleWhyExp', { pct: pct }); }
    else { light = 'yellow'; verdict = t('simpleYellow'); why = t('simpleWhyMid', { pct: pct }); }
    return { light: light, verdict: verdict, why: why, pros: [], cons: [], price: price, suggestStop: Math.min(lo, price * 0.95), resistance: hi, det: { posRange: pos, support: lo, resistance: hi }, simple: true };
  }

  /* ── คุมเงิน/ความเสี่ยง (USD, ซื้อ BTC เศษส่วนได้ — ไม่ floor เป็นหน่วยเต็ม) ──── */
  function riskCalc(o) {
    var capital = o.capital, riskPct = o.riskPct, entry = o.entry, stop = o.stop, comm = o.comm / 100;
    var perUnit = entry - stop;
    if (!(perUnit > 0)) return { error: t('riskErrStop') };
    var riskBudget = capital * riskPct / 100;
    var qty = riskBudget / perUnit, note = ''; /* ไม่ floor — ซื้อ BTC เป็นเศษส่วนได้ */
    var cost = qty * entry;
    if (cost > capital) {
      var maxQty = capital / entry;
      if (maxQty > 0) { qty = maxQty; cost = qty * entry; note = t('riskCapLimitedNote'); }
    }
    var R = perUnit, breakeven = entry * (1 + comm) / (1 - comm);
    var rr = isFinite(o.resistance) && o.resistance > entry ? (o.resistance - entry) / R : NaN;
    return { qty: qty, cost: cost, riskUsd: qty * perUnit, tp1: entry + R, tp2: entry + 2 * R, tp3: entry + 3 * R, breakeven: breakeven, rr: rr, riskBudget: riskBudget, note: note };
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
    var price = 45000, i; /* ราคาตัวอย่างระดับ BTC ทั่วไป */
    for (i = 0; i < n; i++) {
      var ret = 0.0006 + (rnd() - 0.5) * 0.06, open = price, close = Math.max(1, open * (1 + ret)); /* ผันผวนมากกว่าหุ้น/ทองในโค้ดต้นแบบ */
      opens.push(+open.toFixed(2)); closes.push(+close.toFixed(2));
      highs.push(+(Math.max(open, close) * (1 + rnd() * 0.02)).toFixed(2));
      lows.push(+(Math.min(open, close) * (1 - rnd() * 0.02)).toFixed(2));
      vols.push(Math.round(2e4 + rnd() * 8e4)); price = close;
    }
    return toSeries(daysAgoDates(n), opens, highs, lows, closes, vols);
  }
  function parsePaste(text) {
    var nums = (text.match(/-?\d+(\.\d+)?/g) || []).map(Number).filter(function (x) { return isFinite(x) && x > 0; });
    if (nums.length < 5) return null;
    var opens = [], highs = [], lows = [], vols = [], i;
    for (i = 0; i < nums.length; i++) {
      var open = i === 0 ? nums[0] : nums[i - 1];
      opens.push(open); highs.push(Math.max(open, nums[i]) * 1.008); lows.push(Math.min(open, nums[i]) * 0.992); vols.push(0);
    }
    return toSeries(daysAgoDates(nums.length), opens, highs, lows, nums, vols);
  }

  /* ── ดึงราคา Yahoo (BTC-USD) หลายเส้นทาง best-effort ─────────── */
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
  function defaultYahooParser(txt) { return parseYahoo(JSON.parse(txt)); }
  function fetchPrice(sym) {
    var base = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?range=1y&interval=1d';
    var enc = encodeURIComponent(base);
    var tries = [
      { name: 'allorigins', url: 'https://api.allorigins.win/raw?url=' + enc },
      { name: 'codetabs', url: 'https://api.codetabs.com/v1/proxy/?quest=' + enc },
      { name: 'corseu', url: 'https://cors.eu.org/' + base },
      { name: 'corsworkers', url: 'https://test.cors.workers.dev/?' + base },
      { name: 'corsproxy', url: 'https://corsproxy.io/?url=' + enc },
      { name: t('directSourceLabel'), url: base }
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

  /* ── cache ราคา (localStorage) — กันดึงพลาดแล้วหน้าว่าง/ error ── */
  function cacheKey(sym) { return 'tanot:invest:cache:btc:' + sym; }
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
    if (mins < 1) return t('ageJustNow');
    if (mins < 60) return t('ageMinAgo', { n: mins });
    var hrs = Math.round(mins / 60);
    if (hrs < 24) return t('ageHrAgo', { n: hrs });
    return t('ageDaysAgo', { n: Math.round(hrs / 24) });
  }

  /* ══════ อัตราแลกเปลี่ยน USD→บาท (ทางเลือก, best-effort, ใช้ cache ร่วมกับหน้าอื่น) ══════ */
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
      { url: 'https://api.allorigins.win/raw?url=' + enc },
      { url: 'https://api.codetabs.com/v1/proxy/?quest=' + enc },
      { url: 'https://cors.eu.org/' + base },
      { url: 'https://test.cors.workers.dev/?' + base },
      { url: 'https://corsproxy.io/?url=' + enc },
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
    el.textContent = (fxOn() && isFinite(p)) ? ('≈ ' + baht(p * fxRate) + t('perBtcAtRate')) : '';
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
      if (c) { fxRate = c.rate; $('fxRate').value = c.rate.toFixed(2); setFxStatus(t('fxStaleCached', { age: cacheAgeText(c.ts) }), 'ok'); updatePriceFx(); }
      else setFxStatus(t('fxFetchFail'), 'err');
    });
  }

  /* ══════ ดัชนีความกลัว-ความโลภ (alternative.me, best-effort) ══════ */
  var FNG_CLASS_KEY = { 'Extreme Fear': 'fngClassExtFear', 'Fear': 'fngClassFear', 'Neutral': 'fngClassNeutral', 'Greed': 'fngClassGreed', 'Extreme Greed': 'fngClassExtGreed' };
  function fngClassLabel(classification) { var k = FNG_CLASS_KEY[classification]; return k ? t(k) : classification; }
  function parseFng(txt) {
    var j = JSON.parse(txt), d = j && j.data && j.data[0];
    if (!d || !isFinite(parseInt(d.value, 10))) throw new Error('no data');
    return { value: parseInt(d.value, 10), classification: d.value_classification, ts: d.timestamp };
  }
  function fetchFng() {
    var base = 'https://api.alternative.me/fng/?limit=1&format=json', enc = encodeURIComponent(base);
    var tries = [
      { url: base }, /* ลองตรงก่อน — API นี้เปิด CORS */
      { url: 'https://api.allorigins.win/raw?url=' + enc },
      { url: 'https://api.codetabs.com/v1/proxy/?quest=' + enc },
      { url: 'https://cors.eu.org/' + base },
      { url: 'https://test.cors.workers.dev/?' + base },
      { url: 'https://corsproxy.io/?url=' + enc }
    ];
    var i = 0;
    function next() { if (i >= tries.length) return Promise.reject(new Error('fail')); return fetchOne(tries[i++].url, 7000, parseFng).catch(next); }
    return next();
  }
  function fngCacheKey() { return 'tanot:invest:cache:btc:fng'; }
  function saveFngCache(o) { try { localStorage.setItem(fngCacheKey(), JSON.stringify({ ts: Date.now(), value: o.value, classification: o.classification })); } catch (e) {} }
  function loadFngCache() { try { var o = JSON.parse(localStorage.getItem(fngCacheKey())); return (o && isFinite(o.value)) ? o : null; } catch (e) { return null; } }
  function renderFngValue(value, classification, badgeCls, badgeText) {
    $('fngNum').textContent = value;
    $('fngLabel').textContent = fngClassLabel(classification) + ' (' + value + '/100)';
    $('fngMarker').style.left = Math.max(0, Math.min(100, value)) + '%';
    var badge = $('fngBadge'); badge.style.display = 'inline-block'; badge.className = 'src-badge ' + badgeCls; badge.textContent = badgeText;
  }
  var lastFng = null;
  function runFng() {
    fetchFng().then(function (o) {
      saveFngCache(o); lastFng = { data: o, stale: false };
      renderFngValue(o.value, o.classification, 'real', t('fngLiveSrc'));
    }, function () {
      var c = loadFngCache();
      if (c) { lastFng = { data: c, stale: true }; renderFngValue(c.value, c.classification, 'real', t('fngStaleSrc', { age: cacheAgeText(c.ts) })); }
      else {
        lastFng = null;
        $('fngLabel').textContent = t('fngFail');
        var badge = $('fngBadge'); badge.style.display = 'inline-block'; badge.className = 'src-badge paste'; badge.textContent = t('fngRetryLater');
      }
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
    if (src.kind === 'demo') { el.className = 'src-badge demo'; el.textContent = t('demoSrcBadge'); }
    else if (src.kind === 'paste') { el.className = 'src-badge paste'; el.textContent = t('pasteSrcBadge', { n: days }); }
    else { el.className = 'src-badge real'; el.textContent = t('realSrcBadge', { src: src.label || t('realPriceLabel'), stale: src.stale ? t('staleLastPrice', { age: cacheAgeText(src.cachedAt) }) : t('realPriceLabel'), n: days }); }
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
        [t('detRsi'), fmt(d.rsi, 1)], [t('detMacdHist'), fmt(d.macdHist, 3)],
        [t('detBbUpper'), fmt(d.bbUpper)], [t('detBbLower'), fmt(d.bbLower)],
        [t('detAtr'), fmt(d.atr)], [t('detSupport'), fmt(d.support)], [t('detResistance'), fmt(d.resistance)],
        [t('detAdx'), isFinite(d.adx) ? fmt(d.adx, 0) + (d.adx >= 20 ? ' · ' + t('adxStrong') : ' · ' + t('adxWeak')) : '—'],
        [t('detPsar'), d.psar ? fmt(d.psar.sar) + (d.psar.up ? ' · ' + t('psarUp') : ' · ' + t('psarDown')) : '—']
      ], html = '';
      rows.forEach(function (r) { html += '<div class="k">' + r[0] + '</div><div class="v">' + r[1] + '</div>'; });
      $('detKv').innerHTML = html;
      $('detailsBox').style.display = 'block';
    } else { $('detailsBox').style.display = 'none'; }

    if (!$('entry').value) $('entry').value = a.price.toFixed(2);
    if (!$('stop').value && isFinite(a.suggestStop)) $('stop').value = a.suggestStop.toFixed(2);
  }

  function setStatus(msg, cls) { var el = $('fetchStatus'); el.textContent = msg; el.className = 'status' + (cls ? ' ' + cls : ''); }

  function doAnalyze() {
    if (lastSeries) { useSeries(lastSeries); return; }
    var price = num($('price').value), hi = num($('hi').value), lo = num($('lo').value);
    if (!isFinite(price)) { setStatus(t('errEnterPriceFirst'), 'err'); return; }
    updatePriceFx();
    $('chartCard').style.display = 'none';
    if (isFinite(hi) && isFinite(lo) && hi > lo) showAnalysis(analyzeSimple(price, hi, lo));
    else {
      showAnalysis({ light: 'gray', verdict: t('grayVerdictNeedRange'), why: t('grayWhyNeedRange'), pros: [], cons: [], price: price, suggestStop: price * 0.95, resistance: NaN, det: {}, simple: true });
      $('detailsBox').style.display = 'none';
    }
  }
  /* ══════ Live Market Data Gateway ═════════════════════════════════════
     ลำดับความสำคัญ: Tanot Gateway ของตัวเอง (ถ้าตั้งค่าไว้) -> Twelve Data (ใส่ API key เอง) -> Yahoo/ย้อนหลัง (เดิม)
     ตั้งค่าเดียวกับหน้าหุ้นไทย/หุ้นโลก (localStorage key ร่วมกัน) — สินทรัพย์คงที่ (BTC) ไม่มีช่องพิมพ์ symbol */
  var LIVE_CFG_KEY = 'tanot:market:live-config:v1';
  var TD_SYM = SYM.replace('-', '/'); // Twelve Data ใช้รูปแบบ BTC/USD
  var liveTimer = null, liveBusy = false, liveLast = null;
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
    title.textContent = label; m.textContent = meta || '';
  }
  function gatewayBase(c) { return (c.gateway || '').replace(/\/$/, ''); }
  function fetchJson(url, opts) {
    return fetch(url, Object.assign({ headers: { 'Accept': 'application/json' } }, opts || {})).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
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
    setLiveUI('live', t('marketModeLive'), q.source + ' · ' + ch + pct + ' · ' + t('updatedAt', { time: tm }));
    setStatus(t('priceLiveFrom', { price: Number(q.price).toFixed(2), src: q.source, time: tm }), 'ok');
  }
  function refreshLiveQuote() {
    if (liveBusy) return; var c = liveCfg();
    if (c.provider === 'yahoo') { setLiveUI('', t('marketModeHist'), t('marketMetaHistoricalUse')); return; }
    liveBusy = true;
    var pr = c.provider === 'twelvedata' ? fetchTwelveQuote(TD_SYM, c) : fetchGatewayQuote(SYM, c);
    pr.then(applyLiveQuote).catch(function () { setLiveUI('delay', t('marketModeFallback'), t('marketMetaFallback')); }).finally(function () { liveBusy = false; });
  }
  function stopLive() { if (liveTimer) { clearInterval(liveTimer); liveTimer = null; } }
  function startLive() { stopLive(); var c = liveCfg(); if (c.provider === 'yahoo') return; liveTimer = setInterval(refreshLiveQuote, Math.max(5, Number(c.interval) || 5) * 1000); refreshLiveQuote(); }
  function initLiveControls() {
    var c = liveCfg(), p = $('marketProvider'), g = $('marketGateway'), k = $('marketApiKey'), iv = $('marketInterval');
    if (!p) return; p.value = c.provider; g.value = c.gateway || ''; k.value = ''; iv.value = String(c.interval || 5);
    $('marketSettings').addEventListener('click', function () { var x = $('marketSettingsPanel'); x.hidden = !x.hidden; });
    $('marketSave').addEventListener('click', function () { var next = { provider: p.value, gateway: g.value.trim(), apiKey: k.value.trim() || c.apiKey, interval: Number(iv.value) || 5 }; saveLiveCfg(next); c = next; startLive(); setStatus(t('marketSavedMsg'), 'ok'); });
    $('marketClear').addEventListener('click', function () { c.apiKey = ''; saveLiveCfg(c); k.value = ''; setStatus(t('marketApiKeyCleared'), 'ok'); });
    $('marketRefresh').addEventListener('click', refreshLiveQuote);
    window.addEventListener('beforeunload', stopLive);
    startLive();
  }
  function doFetch() {
    setStatus(t('fetchingSym', { sym: SYM })); $('fetchBtn').disabled = true;
    var c = liveCfg();
    var livePromise = c.provider === 'twelvedata' ? fetchTwelveQuote(TD_SYM, c) : c.provider === 'gateway' ? fetchGatewayQuote(SYM, c) : Promise.reject(new Error('historical'));
    livePromise.then(function (q) {
      applyLiveQuote(q);
      return getSeries(SYM).then(function (r) { var s = r.series; useSeries(s, t('priceLiveFromSeries', { sym: SYM, src: q.source, n: s.closes.length }), 'ok', { kind: 'real', label: SYM }); });
    }).catch(function () {
      return getSeries(SYM).then(function (r) {
        var s = r.series;
        if (r.stale) useSeries(s, t('staleUseSaved', { age: cacheAgeText(r.cachedAt), n: s.closes.length }), 'ok', { kind: 'real', label: SYM, stale: true, cachedAt: r.cachedAt });
        else useSeries(s, t('historicalFromSrc', { src: s.source, n: s.closes.length }), 'ok', { kind: 'real', label: SYM });
      });
    }).catch(function () { setStatus(t('fetchFail'), 'err'); }).finally(function () { $('fetchBtn').disabled = false; });
  }
  function doDemo() { useSeries(demoData(), t('demoStatus'), 'ok', { kind: 'demo' }); }
  function doPaste() {
    var s = parsePaste($('pasteBox').value || '');
    if (!s) { setStatus(t('pasteErrShort'), 'err'); return; }
    useSeries(s, t('pasteOk', { n: s.closes.length }), 'ok', { kind: 'paste' });
  }

  /* ── คำนวณเงิน (USD, BTC เศษส่วน) ──────────────────────────── */
  function doCalc() {
    var capital = num($('capital').value), riskPct = num($('riskPct').value);
    var entry = num($('entry').value), stop = num($('stop').value), comm = num($('comm').value);
    if (!isFinite(entry)) entry = num($('price').value);
    if (!isFinite(entry)) { setStatus(t('errNeedEntry'), 'err'); return; }
    if (!isFinite(stop)) { stop = (lastAnalysis && isFinite(lastAnalysis.suggestStop)) ? lastAnalysis.suggestStop : entry * 0.95; $('stop').value = stop.toFixed(2); }
    if (!isFinite(capital) || capital <= 0) { capital = 10000; $('capital').value = capital; }
    if (!isFinite(riskPct) || riskPct <= 0) { riskPct = 1; $('riskPct').value = riskPct; }
    if (!isFinite(comm) || comm < 0) { comm = 0.25; $('comm').value = comm; }

    var res = riskCalc({ capital: capital, riskPct: riskPct, entry: entry, stop: stop, comm: comm, resistance: lastAnalysis ? lastAnalysis.resistance : NaN });
    var box = $('riskResult');
    if (res.error) {
      $('riskHeadline').innerHTML = '<span style="color:var(--err)">' + res.error + '</span>';
      $('riskKv').innerHTML = ''; $('tpRow').innerHTML = ''; box.classList.add('show'); $('saveBtn').style.display = 'none'; return;
    }
    $('riskHeadline').innerHTML = t('calcQtyLine', { qty: fmt(res.qty, 6), sats: fmt0(res.qty * 1e8), cost: usd0(res.cost) }) + fxSpan(res.cost);
    var kv = '';
    kv += '<div class="k">' + t('kvIfWrong') + '</div><div class="v risk">' + usd0(res.riskUsd) + fxSpan(res.riskUsd) + '</div>';
    kv += '<div class="k">' + t('kvStop') + '</div><div class="v">' + fmt(stop) + '</div>';
    kv += '<div class="k">' + t('kvBreakeven') + '</div><div class="v">' + fmt(res.breakeven) + '</div>';
    if (isFinite(res.rr)) kv += '<div class="k">' + t('kvRr') + '</div><div class="v">' + fmt(res.rr, 1) + ' : 1</div>';
    $('riskKv').innerHTML = kv;
    $('tpRow').innerHTML = '<span class="tp-chip">' + t('tpChip1', { v: fmt(res.tp1) }) + '</span><span class="tp-chip">' + t('tpChip2', { v: fmt(res.tp2) }) + '</span><span class="tp-chip">' + t('tpChip3', { v: fmt(res.tp3) }) + '</span>';
    if (res.note) $('tpRow').innerHTML += '<div style="flex:1 1 100%;font-size:12px;color:var(--warn);margin-top:6px">ℹ️ ' + res.note + '</div>';
    box.classList.add('show');
    $('saveBtn').style.display = 'inline-flex';
    $('saveBtn')._data = { qty: res.qty, cost: entry };
  }

  /* ── พอร์ต ──────────────────────────────────────────────────── */
  function loadPf() { try { return JSON.parse(localStorage.getItem(PF_KEY)) || []; } catch (e) { return []; } }
  function savePf(a) { try { localStorage.setItem(PF_KEY, JSON.stringify(a)); } catch (e) {} DriveSync.scheduleSync(); }
  function renderPf() {
    var pf = loadPf(), box = $('pfBox');
    if (!pf.length) { box.innerHTML = '<div class="pf-empty">' + t('pfEmptyAlt') + '</div>'; return; }
    var html = '<table class="pf-table"><thead><tr><th>' + t('pfColQty') + '</th><th>' + t('pfColCost') + '</th><th>' + t('pfColCur') + '</th><th>' + t('pfColPl') + '</th><th></th></tr></thead><tbody>';
    pf.forEach(function (h, i) {
      html += '<tr data-i="' + i + '"><td>' + fmt(h.qty, 6) + '</td><td>' + fmt(h.cost) + '</td>' +
        '<td><input type="number" class="pf-price" inputmode="decimal" step="0.01" placeholder="' + t('pfPricePh') + '" value="' + (h.cur != null ? h.cur : '') + '"></td>' +
        '<td class="pf-pl">—</td><td class="pf-actions"><button class="pf-sell" title="' + t('pfSellBtnTitle') + '">' + t('pfSellBtn') + '</button> <button class="pf-del" title="' + t('pfDelTitle') + '">✕</button></td></tr>' +
        '<tr class="pf-sellrow" data-sr="' + i + '"><td colspan="5"></td></tr>';
    });
    html += '</tbody></table>'; box.innerHTML = html;
    [].forEach.call(box.querySelectorAll('tr[data-i]'), function (tr) {
      var i = +tr.getAttribute('data-i'), h = pf[i], inp = tr.querySelector('.pf-price'), cell = tr.querySelector('.pf-pl');
      var sellCell = box.querySelector('tr[data-sr="' + i + '"] td');
      function upd() {
        var cur = num(inp.value);
        if (!isFinite(cur)) { cell.textContent = '—'; cell.className = 'pf-pl'; return; }
        var pl = (cur - h.cost) * h.qty, pct = (cur / h.cost - 1) * 100;
        cell.innerHTML = (pl >= 0 ? '+' : '−') + usd0(Math.abs(pl)) + ' (' + (pct >= 0 ? '+' : '') + fmt(pct, 1) + '%)' + fxSpan(pl);
        cell.className = 'pf-pl ' + (pl >= 0 ? 'up' : 'down');
      }
      inp.addEventListener('input', function () { upd(); h.cur = num(inp.value); savePf(pf); });
      tr.querySelector('.pf-del').addEventListener('click', function () { pf.splice(i, 1); savePf(pf); renderPf(); });
      tr.querySelector('.pf-sell').addEventListener('click', function () {
        sellCell.innerHTML = '<div class="sell-verdict warn">' + t('pfSellFetching', { sym: SYM }) + '</div>';
        getSeries(SYM).then(function (r) {
          var s = r.series, a = analyzeSeries(s), v = sellVerdict(a), price = s.closes[s.closes.length - 1];
          inp.value = price.toFixed(2); h.cur = price; savePf(pf); upd();
          var pl = (price - h.cost) * h.qty, pct = (price / h.cost - 1) * 100;
          sellCell.innerHTML = '<div class="sell-detail"><div class="sell-verdict ' + v.cls + '">' + v.headline +
            '<br><span style="font-weight:500">' + t('sellDetailPrice', {
              price: fmt(price), stale: r.stale ? t('staleSaved', { age: cacheAgeText(r.cachedAt) }) : '',
              cost: fmt(h.cost), plWord: pl >= 0 ? t('profitWord') : t('lossWord'), pl: usd0(Math.abs(pl)) + fxSpan(pl),
              sign: pct >= 0 ? '+' : '', pct: fmt(pct, 1)
            }) + '</span>' +
            sellLevelsHtml(v.levels) + '</div></div>';
        }, function () {
          sellCell.innerHTML = '<div class="sell-detail"><div class="sell-verdict warn">' + t('sellFetchFail', { sym: SYM }) + '</div></div>';
        });
      });
      upd();
    });
  }
  function addHolding() {
    var qty = num($('pfQty').value), cost = num($('pfCost').value);
    if (!isFinite(qty) || qty <= 0 || !isFinite(cost) || cost <= 0) { alert(t('alertPfInvalid')); return; }
    var pf = loadPf(); pf.push({ qty: qty, cost: cost, ts: Date.now() });
    savePf(pf); $('pfQty').value = ''; $('pfCost').value = ''; renderPf();
  }

  /* ── "ควรขายไหม" สำหรับ BTC ที่ถือ ─────────────────────────────── */
  function sellVerdict(a) {
    var det = a.det || {}, ps = det.psar;
    var cls, headline;
    if (ps && !ps.up) { cls = 'no'; headline = t('sellVerdictSar'); }
    else if (!a.uptrend || (isFinite(det.ema20) && a.price < det.ema20)) { cls = 'no'; headline = t('sellVerdictTrend'); }
    else if (isFinite(a.rsi) && a.rsi > 70) { cls = 'warn'; headline = t('sellVerdictRsi'); }
    else if (isFinite(a.resistance) && a.price >= a.resistance * 0.98) { cls = 'warn'; headline = t('sellVerdictResist'); }
    else { cls = 'go'; headline = t('sellVerdictGo'); }

    var levels = [
      {
        key: 'sar', type: 'stop', label: t('lvSarLabel'),
        price: ps ? ps.sar : NaN,
        reason: !ps ? t('lvSarReasonNoData')
          : (ps.up ? t('lvSarReasonUp', { v: fmt(ps.sar) }) : t('lvSarReasonDown'))
      },
      {
        key: 'stop', type: 'stop', label: t('lvStopLabel'),
        price: a.suggestStop,
        reason: !isFinite(a.suggestStop) ? t('lvStopReasonNoData')
          : t('lvStopReason') + (isFinite(det.atr) ? t('lvStopAtrSuffix', { v: fmt(det.atr) }) : '')
      },
      {
        key: 'ema20', type: 'warn', label: t('lvEma20Label'),
        price: det.ema20,
        reason: !isFinite(det.ema20) ? t('lvEma20ReasonNoData') : t('lvEma20Reason')
      },
      {
        key: 'resistance', type: 'tp', label: t('lvResistLabel'),
        price: isFinite(det.resistance) ? det.resistance : a.resistance,
        reason: !isFinite(isFinite(det.resistance) ? det.resistance : a.resistance) ? t('lvResistReasonNoData') : t('lvResistReason')
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

  /* ── เช็กลิสต์ก่อนเข้าไม้ (GO/NO-GO) — เกณฑ์เสี่ยง ≤1% + ห้ามเลเวอเรจ ── */
  var btcAnswers = { noLeverage: null };
  function checklistChecks() {
    var a = lastAnalysis, det = (a && a.det) ? a.det : {};
    var entry = num($('entry').value), stop = num($('stop').value), riskPct = num($('riskPct').value);
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
      ok: isFinite(riskPct) && riskPct <= 1,
      txt: (isFinite(riskPct) && riskPct <= 1)
        ? t('chkRiskOk', { v: riskPct })
        : t('chkRiskHigh', { v: isFinite(riskPct) ? riskPct + '%' : '-' })
    });
    if (a && isFinite(a.resistance) && stopOk && a.resistance > entry) {
      var rr = (a.resistance - entry) / (entry - stop), rrOk = rr >= 2;
      checks.push({ ok: rrOk, txt: rrOk ? t('chkRrOk', { v: rr.toFixed(1) }) : t('chkRrLow', { v: rr.toFixed(1) }) });
    } else {
      checks.push({ ok: null, txt: t('chkRrNeedData') });
    }
    var lv = btcAnswers.noLeverage;
    checks.push({
      ok: lv === 'yes' ? true : lv === 'no' ? false : null,
      txt: lv === 'yes' ? t('chkLeverageYes')
        : lv === 'no' ? t('chkLeverageNo')
        : t('chkLeverageUnknown')
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

  /* ── Expectancy ─────────────────────────────────────────────── */
  function doExpectancy() {
    var w = num($('eWin').value) / 100, wr = num($('eWinR').value), lr = num($('eLossR').value);
    var box = $('eResult');
    if (!(w >= 0 && w <= 1) || !isFinite(wr) || !isFinite(lr) || wr < 0 || lr <= 0) {
      box.className = 'verdict-box warn'; box.textContent = t('eFillErr'); box.style.display = 'block'; return;
    }
    var exp = w * wr - (1 - w) * lr;
    var beWin = lr / (wr + lr) * 100;
    var msg = t('eExpectancyLine', { sign: exp >= 0 ? '+' : '', exp: exp.toFixed(2), sign2: exp >= 0 ? '+' : '−', usdAmt: usd0(Math.abs(exp) * 1000), be: beWin.toFixed(0) });
    if (exp > 0.1) { box.className = 'verdict-box go'; box.innerHTML = t('eGoTitle') + '<br>' + msg + '<br><span style="font-weight:500">' + t('eGoNote') + '</span>'; }
    else if (exp > 0) { box.className = 'verdict-box warn'; box.innerHTML = t('eWarnTitle') + '<br>' + msg + '<br><span style="font-weight:500">' + t('eWarnNote') + '</span>'; }
    else { box.className = 'verdict-box no'; box.innerHTML = t('eNoTitle') + '<br>' + msg + '<br><span style="font-weight:500">' + t('eNoNote') + '</span>'; }
    box.style.display = 'block';
  }

  /* ── สมุดเทรด + สถิติ ────────────────────────────────────────── */
  function loadJn() { try { return JSON.parse(localStorage.getItem(JN_KEY)) || []; } catch (e) { return []; } }
  function saveJn(a) { try { localStorage.setItem(JN_KEY, JSON.stringify(a)); } catch (e) {} DriveSync.scheduleSync(); }
  function addJournal() {
    var en = num($('jEntry').value), ex = num($('jExit').value), qty = num($('jQty').value);
    if (!isFinite(en) || !isFinite(ex) || !isFinite(qty) || qty <= 0) { alert(t('alertJInvalid')); return; }
    var jn = loadJn(); jn.push({ en: en, ex: ex, qty: qty, pl: (ex - en) * qty, ts: Date.now() });
    saveJn(jn); $('jEntry').value = ''; $('jExit').value = ''; $('jQty').value = ''; renderJournal();
  }
  function renderJournal() {
    var jn = loadJn(), box = $('jBox'), stats = $('jStats');
    if (!jn.length) { box.innerHTML = '<div class="pf-empty" style="font-size:13px;color:var(--muted);padding:8px 0">' + t('jEmpty') + '</div>'; stats.style.display = 'none'; return; }
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
    var html = '<table class="j-table"><thead><tr><th>' + t('jColEntry') + '</th><th>' + t('jColExit') + '</th><th>' + t('jColQty') + '</th><th>' + t('jColResult') + '</th><th></th></tr></thead><tbody>';
    jn.slice().reverse().forEach(function (r, ri) {
      var idx = jn.length - 1 - ri;
      html += '<tr><td>' + fmt(r.en) + '</td><td>' + fmt(r.ex) + '</td><td>' + fmt(r.qty, 6) + '</td>' +
        '<td class="' + (r.pl >= 0 ? 'j-win' : 'j-loss') + '">' + (r.pl >= 0 ? '+' : '−') + usd0(Math.abs(r.pl)) + '</td>' +
        '<td><button class="j-del" data-i="' + idx + '">✕</button></td></tr>';
    });
    html += '</tbody></table>'; box.innerHTML = html;
    [].forEach.call(box.querySelectorAll('.j-del'), function (b) { b.addEventListener('click', function () { var jn = loadJn(); jn.splice(+b.getAttribute('data-i'), 1); saveJn(jn); renderJournal(); }); });
  }

  /* ── ออม Bitcoin แบบ DCA (stateless — calculator ล้วนๆ ไม่มี log แยก) ── */
  function simulateBtcDCA(pmt, startPrice, annualPct, months) {
    var rm = annualPct / 100 / 12, price = startPrice, qty = 0, contrib = 0, series = [];
    for (var i = 0; i < months; i++) {
      price = price * (1 + rm);
      var q = pmt / price;
      qty += q; contrib += pmt;
      series.push({ month: i + 1, price: price, qty: qty, value: qty * price, contrib: contrib });
    }
    return { qty: qty, price: price, value: qty * price, contrib: contrib, series: series };
  }
  function drawBtcDcaChart(r) {
    var s = r.series, W = 640, H = 220, pad = 8, n = s.length;
    var val = [], con = [], i;
    for (i = 0; i < n; i++) { val.push(s[i].value); con.push(s[i].contrib); }
    var max = Math.max(val[n - 1], con[n - 1]) || 1;
    var x = function (i) { return pad + i / Math.max(1, n - 1) * (W - 2 * pad); };
    var y = function (v) { return pad + (1 - v / max) * (H - 2 * pad); };
    function path(a) { var d = '', i; for (i = 0; i < a.length; i++) d += (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(a[i]).toFixed(1) + ' '; return d; }
    var area = path(val) + 'L' + x(n - 1).toFixed(1) + ' ' + y(0).toFixed(1) + ' L' + x(0).toFixed(1) + ' ' + y(0).toFixed(1) + ' Z';
    var svg = '';
    svg += '<path d="' + area + '" fill="#F7931A" opacity="0.12"/>';
    svg += '<path d="' + path(con) + '" fill="none" stroke="#8B94A8" stroke-width="1.6" stroke-dasharray="5 3"/>';
    svg += '<path d="' + path(val) + '" fill="none" stroke="#F7931A" stroke-width="2.4" stroke-linejoin="round"/>';
    $('dcaChart').innerHTML = svg;
  }
  function dcaYearTable(r) {
    var html = '<table class="yr-table"><thead><tr><th>' + t('dcaYrHdYear') + '</th><th>' + t('dcaYrHdContrib') + '</th><th>' + t('dcaYrHdQty') + '</th><th>' + t('dcaYrHdVal') + '</th></tr></thead><tbody>';
    var yrs = Math.round(r.series.length / 12), i;
    for (i = 1; i <= yrs; i++) {
      var idx = i * 12 - 1;
      if (idx >= r.series.length) break;
      var row = r.series[idx];
      html += '<tr><td>' + t('dcaYrCol', { n: i }) + '</td><td>' + usd0(row.contrib) + '</td><td>' + fmt(row.qty, 6) + ' BTC</td><td>' + usd0(row.value) + '</td></tr>';
    }
    html += '</tbody></table>';
    return html;
  }
  function doDCA() {
    var pmt = num($('dcaPmt').value) || 0;
    var startPrice = num($('dcaStart').value);
    var years = num($('dcaYears').value) || 5;
    var cagr = num($('dcaCagr').value);
    if (!isFinite(cagr)) { cagr = 15; $('dcaCagr').value = 15; }
    if (!isFinite(startPrice) || startPrice <= 0) { alert(t('alertDcaStart')); return; }
    if (pmt <= 0) { alert(t('alertDcaPmt')); return; }
    var r = simulateBtcDCA(pmt, startPrice, cagr, Math.round(years * 12));
    $('dcaOut').style.display = 'block';

    $('dcaContrib').textContent = usd0(r.contrib);
    $('dcaQty').textContent = fmt(r.qty, 6) + ' BTC';
    $('dcaSats').textContent = '≈ ' + fmt0(r.qty * 1e8) + ' sats';
    $('dcaValue').textContent = usd0(r.value);
    $('dcaGain').textContent = (r.value - r.contrib >= 0 ? '+' : '') + usd0(r.value - r.contrib);

    drawBtcDcaChart(r);
    $('dcaYrTable').innerHTML = dcaYearTable(r);
  }

  /* ══════ สำรองพอร์ต + สมุดเทรดขึ้น Google Drive (ไม่บังคับ) ══════ */
  var DRIVE_CLIENT_ID = '497048581273-akpavakt6m34lhqbjf1irg3m8vl6u27u.apps.googleusercontent.com';
  var DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
  var DRIVE_FOLDER_NAME = 'OME_Progress';
  var DRIVE_FILE_NAME = 'invest-bitcoin-data.json';
  var DRIVE_CONNECTED_KEY = 'tanot:invest:bitcoin:driveConnected';
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
              self.setStatus(self.connected ? t('driveAutoFail') : t('driveConnectFail', { err: resp.error }), 'err');
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
        .then(function (r) { if (!r.ok) throw new Error(t('driveErrSearchFolder', { code: r.status })); return r.json(); })
        .then(function (data) {
          if (data.files && data.files.length) { self.folderId = data.files[0].id; return self.folderId; }
          return self.authFetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' })
          }).then(function (r) { if (!r.ok) throw new Error(t('driveErrCreateFolder', { code: r.status })); return r.json(); })
            .then(function (d) { self.folderId = d.id; return self.folderId; });
        });
    },
    findFile: function () {
      var self = this;
      if (self.fileId) return Promise.resolve(self.fileId);
      var q = encodeURIComponent("name='" + DRIVE_FILE_NAME + "' and '" + self.folderId + "' in parents and trashed=false");
      return self.authFetch('https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id,name)')
        .then(function (r) { if (!r.ok) throw new Error(t('driveErrSearchFile', { code: r.status })); return r.json(); })
        .then(function (data) { self.fileId = (data.files && data.files[0] && data.files[0].id) || null; return self.fileId; });
    },
    download: function () {
      var self = this;
      return self.authFetch('https://www.googleapis.com/drive/v3/files/' + self.fileId + '?alt=media')
        .then(function (r) { if (!r.ok) throw new Error(t('driveErrDownload', { code: r.status })); return r.json(); });
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
        .then(function (r) { if (!r.ok) throw new Error(t('driveErrUpload', { code: r.status })); return r.json(); })
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
          var mergedPf = self.mergeByTs(remote && remote.portfolio, loadPf());
          var mergedJn = self.mergeByTs(remote && remote.journal, loadJn());
          try { localStorage.setItem(PF_KEY, JSON.stringify(mergedPf)); } catch (e) {}
          try { localStorage.setItem(JN_KEY, JSON.stringify(mergedJn)); } catch (e) {}
          renderPf(); renderJournal();
          return self.upload({ portfolio: mergedPf, journal: mergedJn, savedAt: new Date().toISOString() });
        })
        .then(function () { self.setStatus(t('driveSyncedAt', { time: nowTime() }), 'ok'); })
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
        .then(function () { self.setStatus(t('driveLastSync', { time: nowTime() }), 'ok'); })
        .catch(function (e) {
          var msg = String(e && e.message || e);
          if (msg.indexOf('401') !== -1 || msg.indexOf('403') !== -1) {
            self.accessToken = null;
            self.setStatus(t('driveSessionExpired'), 'err');
          } else {
            self.setStatus(t('driveSyncFailed', { err: msg }), 'err');
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
    ['price', 'hi', 'lo'].forEach(function (id) { $(id).addEventListener('input', function () { lastSeries = null; if (id === 'price') updatePriceFx(); }); });

    $('tfGroup').addEventListener('click', function (e) { var b = e.target.closest('.tf'); if (b) applyTF(+b.getAttribute('data-tf')); });
    $('tgGroup').addEventListener('click', function (e) { var b = e.target.closest('.tg'); if (!b) return; var k = b.getAttribute('data-tg'); tg[k] = !tg[k]; applyToggles(); });

    $('saveBtn').addEventListener('click', function () {
      var d = $('saveBtn')._data; if (!d) return;
      var pf = loadPf(); pf.push({ qty: d.qty, cost: d.cost, ts: Date.now() });
      savePf(pf); renderPf();
      $('saveBtn').textContent = t('savedToPfDone');
      setTimeout(function () { $('saveBtn').innerHTML = t('saveToPfBtn'); }, 1500);
    });
    $('chkForm').addEventListener('click', function (e) {
      var btn = e.target.closest('.yn-btn'); if (!btn) return;
      var row = btn.closest('.yn-row'), key = row.getAttribute('data-key'), val = btn.getAttribute('data-val');
      btcAnswers[key] = val;
      [].forEach.call(row.querySelectorAll('.yn-btn'), function (b) { b.classList.remove('on', 'yes', 'no'); });
      btn.classList.add('on', val);
    });
    $('checkBtn').addEventListener('click', doChecklist);
    $('eBtn').addEventListener('click', doExpectancy);
    $('jAdd').addEventListener('click', addJournal);
    $('pfAdd').addEventListener('click', addHolding);
    $('dcaBtn').addEventListener('click', doDCA);
    $('driveConnectBtn') && $('driveConnectBtn').addEventListener('click', function () { DriveSync.connect(); });

    /* ตัวแปลงสกุลเงิน */
    var fxCached = loadFxCache();
    if (fxCached) { fxRate = fxCached.rate; if ($('fxRate')) $('fxRate').value = fxCached.rate.toFixed(2); }
    $('fxFetchBtn').addEventListener('click', doFxFetch);
    $('fxRate').addEventListener('input', function () { fxRate = num($('fxRate').value); updatePriceFx(); if ($('riskResult').classList.contains('show')) doCalc(); renderPf(); });
    $('fxShowChk').addEventListener('change', function () { updatePriceFx(); if ($('riskResult').classList.contains('show')) doCalc(); renderPf(); });

    renderPf();
    renderJournal();
    runFng();
    DriveSync.init();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.omeApplyLang = function () {
    applyStaticI18n();
    if (lastFng) {
      renderFngValue(lastFng.data.value, lastFng.data.classification, 'real', lastFng.stale ? t('fngStaleSrc', { age: cacheAgeText(lastFng.data.ts) }) : t('fngLiveSrc'));
    } else {
      runFng();
    }
    if ($('lightCard').style.display !== 'none') doAnalyze();
    renderPf();
    renderJournal();
    if ($('riskResult').classList.contains('show')) doCalc();
    if ($('checkResult').style.display !== 'none') doChecklist();
    if ($('eResult').style.display !== 'none') doExpectancy();
    if ($('dcaOut').style.display !== 'none') doDCA();
    DriveSync.setBtn();
  };

  window.__bitcoin ={ sma: sma, emaLast: emaLast, rsi: rsi, rsiSeries: rsiSeries, smaSeries: smaSeries, macd: macd, bollinger: bollinger, atr: atr, analyzeSeries: analyzeSeries, analyzeSimple: analyzeSimple, riskCalc: riskCalc, demoData: demoData, parsePaste: parsePaste, parseYahoo: parseYahoo, checklistChecks: checklistChecks, adx: adx, psar: psar, sellVerdict: sellVerdict, simulateBtcDCA: simulateBtcDCA, parseFng: parseFng };
})();
