/* ══════════════════════════════════════════════════════════════════
   Tanot — หุ้น (ยุบรวมหน้าลงทุน ขั้น 6, docs/invest-consolidation-design.md หัวข้อ 2)
   #th หุ้นไทย / #us หุ้นต่างประเทศ = โค้ดชุดเดียว ปรับตามตลาด (MARKETS) · สูตร/ไฟจราจร/คุมเงิน/ควรขาย/เช็กลิสต์อยู่ใน InvestCalc
   ดึงราคา/ข่าว/FX/Live ผ่าน InvestCore (/api/proxy อย่างเดียว) · AI = คลาวด์อย่างเดียว (ซ่อนปุ่มเมื่อไม่ใช่ pages.dev)
   พอร์ตหุ้นเขียนคีย์เดิม tanot:invest:thstock | globalstock รูปแบบเดิม {sym, shares, cost, ts, cur?} แบบ อ่านสด → แก้ → เขียน ลบ/แก้ด้วย ts
   ตัดแล้ว: Expectancy (ใช้ของจริงจากสมุดเทรด), สมุดเทรดในหน้านี้ (ลิงก์ไป invest-trade-journal.html), Google Drive, โหมด embed
   หมายเหตุ: ตัวช่วยคิด ไม่ใช่คำแนะนำการลงทุน
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var IC = window.InvestCore, Calc = window.InvestCalc;
  var $ = function (id) { return document.getElementById(id); };
  var P = 'tanot:invest:';

  var MARKETS = {
    th: { key: 'th', pf: 'thstock', suffix: '.BK', ccy: 'THB', cur: '฿', live: 'th', aiTask: 'stock:thaistock', risk: 'th', chk: 'th',
      defSym: 'PTT', capital: 100000, comm: 0.157, commMin: 50, newsQ: function (s) { return s + ' หุ้น OR บริษัท'; } },
    us: { key: 'us', pf: 'globalstock', suffix: '', ccy: 'USD', cur: '$', live: 'us', aiTask: 'stock:globalstock', risk: 'us', chk: 'us',
      defSym: 'AAPL', capital: 10000, comm: 0.2, commMin: 0, newsQ: function (s) { return s + ' stock'; } }
  };
  var market = 'th', M = MARKETS.th, curTab = 'th';

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


  var US_COMPANY_INFO = {
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
  var US_SECTOR_FACTORS = {
    'เทคโนโลยี': ['มูลค่าหุ้นมักตั้งราคาด้วยความคาดหวังการเติบโตสูง อ่อนไหวกับทิศทางดอกเบี้ยสหรัฐฯ (Fed)', 'การแข่งขันด้าน AI/นวัตกรรมเปลี่ยนเร็ว งบวิจัยพัฒนาสูงต่อเนื่อง'],
    'การเงิน/ธนาคาร': ['ผลประกอบการอ่อนไหวกับดอกเบี้ยนโยบาย Fed และคุณภาพสินเชื่อ', 'กฎเกณฑ์กำกับดูแลธนาคารสหรัฐฯ (Fed/FDIC) มีผลโดยตรง'],
    'สุขภาพ': ['ขึ้นกับผลทดลองยา/การอนุมัติจาก FDA และการหมดสิทธิบัตร (patent cliff)', 'นโยบายราคายา/ประกันสุขภาพของรัฐบาลสหรัฐฯ มีผลต่อรายได้'],
    'สินค้าอุปโภคบริโภคจำเป็น': ['อ่อนไหวกับต้นทุนวัตถุดิบและค่าเงินดอลลาร์ (รายได้ส่วนหนึ่งมาจากต่างประเทศ)', 'มักเป็นหุ้นตั้งรับ (defensive) ผันผวนน้อยกว่ากลุ่มเทคโนโลยี'],
    'สินค้าฟุ่มเฟือย/ค้าปลีก': ['ยอดขายอ่อนไหวกับกำลังซื้อผู้บริโภคสหรัฐฯ และฤดูกาลจับจ่าย', 'ต้นทุนแรงงาน/ค่าเช่าและการแข่งขันอีคอมเมิร์ซกดดันมาร์จิ้น'],
    'พลังงาน': ['กำไรผันผวนตามราคาน้ำมัน/ก๊าซในตลาดโลก', 'นโยบายพลังงาน/สิ่งแวดล้อมของสหรัฐฯ มีผลต่อการลงทุนระยะยาว'],
    'อุตสาหกรรม': ['รายได้ผูกกับวัฏจักรเศรษฐกิจโลกและการลงทุนโครงสร้างพื้นฐาน', 'อ่อนไหวกับภาษีนำเข้า/ห่วงโซ่อุปทานระหว่างประเทศ']
  };
  var US_COMPANY_INFO_EN = {
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
  var US_SECTOR_FACTORS_EN = {
    'Technology': ['Valuations are usually priced with high growth expectations, sensitive to the direction of US interest rates (the Fed)', 'AI/innovation competition changes fast, with continuously high R&D spending'],
    'Finance/Banking': ["Earnings are sensitive to Fed policy rates and loan quality", "US bank regulation (Fed/FDIC) has a direct effect"],
    'Healthcare': ['Depends on drug trial results/FDA approvals and patent cliffs', "US government drug pricing/health insurance policy affects revenue"],
    'Consumer Staples': ['Sensitive to input costs and the dollar (part of revenue comes from overseas)', 'Usually defensive stocks, less volatile than the technology sector'],
    'Consumer Discretionary/Retail': ['Sales are sensitive to US consumer spending power and shopping seasons', 'Labor/rent costs and e-commerce competition pressure margins'],
    'Energy': ['Profit swings with global oil/gas prices', 'US energy/environmental policy affects long-term investment'],
    'Industrials': ['Revenue is tied to the global economic cycle and infrastructure investment', 'Sensitive to import tariffs/international supply chains']
  };
  var DICT = {
 "th": {
  "whyTitleDefault": "เหตุผลของสัญญาณ",
  "defaultSignal": "สัญญาณ —",
  "defaultSector": "หุ้นไทย",
  "step1Title": "ราคาหุ้นตอนนี้",
  "symLabel": "ชื่อย่อหุ้น (เช่น PTT, ADVANC)",
  "symLabel_us": "ชื่อย่อหุ้น (เช่น AAPL, MSFT)",
  "fetchBtn": "ลองดึงราคา",
  "priceNowLabel": "ราคาตอนนี้ (บาท)",
  "priceNowLabel_us": "ราคาตอนนี้ (USD)",
  "priceNowPh": "เช่น 35.50",
  "priceNowPh_us": "เช่น 180.50",
  "priceHiLabel": "ราคาสูงสุดของรอบ",
  "priceLoLabel": "ราคาต่ำสุดของรอบ",
  "periodPh": "ช่วง 3 เดือน",
  "liveModeHistorical": "โหมดข้อมูล: ย้อนหลัง",
  "refreshBtn": "รีเฟรช",
  "marketSettingsBtn": "ตั้งค่าข้อมูลตลาด",
  "marketSettingsTitle": "ข้อมูลตลาดแบบสด",
  "providerLabel": "แหล่งข้อมูล",
  "providerGateway": "Tanot Data Gateway (แนะนำ)",
  "providerYahoo": "Yahoo / ย้อนหลัง",
  "apiKeyLabel": "Twelve Data API Key",
  "apiKeyNote": "(เก็บในเครื่องเท่านั้น)",
  "apiKeyPh": "ใส่เมื่อมี API key",
  "intervalLabel": "รีเฟรชทุก",
  "interval5": "5 วินาที",
  "interval10": "10 วินาที",
  "interval30": "30 วินาที",
  "saveSettingsBtn": "บันทึกการตั้งค่า",
  "clearApiKeyBtn": "ล้าง API Key",
  "analyzeBtn": "ประเมินให้หน่อย",
  "demoBtn": "ดูกราฟตัวอย่าง (ฝึกอ่าน)",
  "pasteSummary": "วางราคาย้อนหลังเอง (ทางเลือก)",
  "pasteBtn": "ใช้ราคานี้",
  "chartTitle": "กราฟราคา",
  "tf1m": "1เดือน",
  "tf3m": "3เดือน",
  "tf6m": "6เดือน",
  "tf1y": "1ปี",
  "tgMa20": "เฉลี่ย 20",
  "tgMa50": "เฉลี่ย 50",
  "capUp": "แท่งขึ้น",
  "capDn": "แท่งลง",
  "capMa20": "เฉลี่ย 20 วัน",
  "capMa50": "เฉลี่ย 50 วัน",
  "techDetailsSummary": "รายละเอียดทางเทคนิค",
  "techDetailsSummary_us": "ดูรายละเอียดทางเทคนิค ",
  "aiSumTitle": "สรุปหุ้นด้วย AI",
  "aiSumBtn": "สรุปให้หน่อย",
  "step2Title": "ถ้าจะซื้อ ควรใส่เงินเท่าไร ตั้งขายที่ไหน",
  "capitalLabel": "เงินลงทุนทั้งพอร์ต (บาท)",
  "capitalLabel_us": "เงินลงทุนทั้งพอร์ต (USD)",
  "capitalPh": "เช่น 100000",
  "capitalPh_us": "เช่น 10000",
  "riskPctLabel": "ยอมเสี่ยงต่อไม้",
  "unitPctPortfolio": "(% ของพอร์ต)",
  "entryLabel": "ราคาเข้าซื้อ (บาท)",
  "entryLabel_us": "ราคาเข้าซื้อ (USD)",
  "entryPh": "= ราคาตอนนี้",
  "stopLabel": "ราคาตัดขาดทุน (Stop)",
  "stopPh": "แนะนำอัตโนมัติ",
  "commLabel": "ค่าคอมฯ",
  "unitPctPerTrade": "(% ต่อครั้ง)",
  "commMinLabel": "ค่าคอมฯ ขั้นต่ำ",
  "unitBahtPerDay": "(บาท/วัน)",
  "calcBtn": "คำนวณ",
  "saveToPortfolioBtn": "บันทึกเข้าพอร์ต",
  "savedBtn": "บันทึกแล้ว",
  "checklistTitle": "ตรวจก่อนเข้าไม้ — ควรซื้อไหม?",
  "checkBtn": "ตรวจเช็กลิสต์",
  "pfTitle": "พอร์ตของฉัน (หุ้นไทย)",
  "pfTitle_us": "พอร์ตของฉัน (หุ้นต่างประเทศ)",
  "pfSymLabel": "ชื่อหุ้น",
  "pfSharesLabel": "จำนวนหุ้น",
  "pfCostLabel": "ราคาต้นทุน/หุ้น",
  "pfAddBtn": "เพิ่มเข้าพอร์ต",
  "pfEmptyDefault": "ยังไม่มีหุ้นในพอร์ต",
  "pfThSym": "หุ้น",
  "pfThShares": "จำนวน",
  "pfThCost": "ต้นทุน/หุ้น",
  "pfThCur": "ราคาปัจจุบัน",
  "pfThPl": "กำไร/ขาดทุน",
  "pfPricePh": "ราคา",
  "pfSellTitle": "เช็กควรขาย?",
  "pfSellBtn": "ควรขาย?",
  "pfDelTitle": "ลบ",
  "stockNewsDefault": "ข่าวหุ้น",
  "stockNewsWithSym": "ข่าวหุ้น {sym}",
  "oppdayLinkText": "Opportunity Day",
  "liveReal": "สด / Real-time",
  "liveFallback": "สำรอง / Historical",
  "liveNoConn": "แหล่งข้อมูลสดยังเชื่อมต่อไม่ได้ · ใช้ราคาย้อนหลังเป็น fallback",
  "liveYahooMeta": "ใช้ Yahoo สำหรับกราฟย้อนหลัง",
  "liveModePrefix": "โหมดข้อมูล: ",
  "updatedAt": "อัปเดต ",
  "liveHistorical": "ย้อนหลัง / Historical",
  "settingsSaved": "บันทึกการตั้งค่าแล้ว · ระบบจะดึงข้อมูลตามช่วงเวลาที่ตั้ง",
  "apiKeyCleared": "ล้าง API Key จากเครื่องแล้ว",
  "typeSymFirst": "พิมพ์ชื่อย่อหุ้นก่อน เช่น PTT",
  "typeSymFirst_us": "พิมพ์ชื่อย่อหุ้นก่อน เช่น AAPL",
  "fetchingData": "กำลังดึงข้อมูล {sym}…",
  "latestPriceMsg": "ราคาล่าสุด {price} บาท · {source} · {time}",
  "liveFromMsg": "ราคา {sym} สดจาก {source} · กราฟย้อนหลัง {days} วัน",
  "staleDataMsg": "แหล่งข้อมูลสดใช้ไม่ได้ · ใช้ข้อมูลย้อนหลังที่บันทึกไว้ ({age}) · {days} วัน",
  "histFromMsg": "ขณะนี้ใช้ราคาย้อนหลังจาก {source} · {days} วัน",
  "notFoundMsg": "ไม่พบข้อมูลของ {sym} — ตรวจชื่อหุ้นหรือการเชื่อมต่อข้อมูลตลาด",
  "enterPriceFirst": "กรอกอย่างน้อย \"ราคาตอนนี้\" ก่อนนะครับ",
  "chartLibFail": "โหลดไลบรารีกราฟไม่ได้ (ลองออนไลน์แล้วรีเฟรช) — ส่วนไฟจราจร/คำนวณเงินยังใช้ได้",
  "pasteAtLeast5": "วางราคาปิดอย่างน้อย 5 วันก่อนนะครับ",
  "pastedMsg": "ใช้ราคาที่วางแล้ว ({days} วัน)",
  "demoMsg": "กำลังแสดง \"ข้อมูลตัวอย่าง\" (ไม่ใช่ราคาจริง) — ไว้ลองเล่นกราฟและฝึกอ่าน",
  "demoBadge": "ข้อมูลตัวอย่าง — ไม่ใช่ราคาจริง (ไว้ฝึกอ่านกราฟ)",
  "pastedBadge": "ราคาที่วางเอง · {days} วัน",
  "realBadgeLabel": "ราคาจริง",
  "realBadge": "{label} · {status} · {days} วัน",
  "staleLatestPrice": "ราคาล่าสุด {age}",
  "justNow": "เมื่อสักครู่",
  "minsAgo": "{n} นาทีก่อน",
  "hrsAgo": "{n} ชม.ก่อน",
  "daysAgo": "{n} วันก่อน",
  "legendOpen": "เปิด",
  "legendHigh": "สูง",
  "legendLow": "ต่ำ",
  "legendClose": "ปิด",
  "detEma20": "เส้นเฉลี่ย 20 วัน (EMA20)",
  "detEma50": "เส้นเฉลี่ย 50 วัน (EMA50)",
  "detRsi": "RSI (14)",
  "detMacd": "MACD histogram",
  "detBbUp": "กรอบบน (Bollinger)",
  "detBbLo": "กรอบล่าง (Bollinger)",
  "detAtr": "ATR (ความผันผวน)",
  "detSupport": "แนวรับล่าสุด",
  "detResistance": "แนวต้านล่าสุด",
  "detAdx": "ความแรงแนวโน้ม (ADX 14)",
  "detAdxStrong": " · แข็งแรง",
  "detAdxWeak": " · อ่อน",
  "detSar": "จุดตัดขาดทุนตาม (Parabolic SAR)",
  "detSarUp": " · เทรนด์ขึ้น",
  "detSarDn": " · เทรนด์ลง",
  "vGood": "น่าสนใจ — ลองพิจารณา",
  "vBad": "ระวัง — ยังไม่ใช่จังหวะ",
  "vWait": "รอก่อน — ยังไม่มีจังหวะเด่น",
  "vExpensive": "ระวัง — ราคาค่อนข้างแพง",
  "vMid": "รอก่อน — ราคากลางกรอบ",
  "whyCheap": "ราคาอยู่ช่วงถูกเทียบ 3 เดือน",
  "whyExpensive": "ราคาอยู่ช่วงแพงเทียบ 3 เดือน",
  "whySellEase": "แรงขายเริ่มคลาย (RSI ต่ำ กำลังฟื้น)",
  "whyHot": "ราคาร้อนแรงเกินไป (RSI สูง เสี่ยงย่อ)",
  "whyMomUp": "โมเมนตัมเริ่มกลับเป็นบวก",
  "whyMomDn": "โมเมนตัมเริ่มอ่อนลง",
  "whyUptrend": "ยังอยู่ในแนวโน้มขึ้น",
  "whyDowntrend": "อยู่ใต้เส้นแนวโน้ม (ขาลง/พักตัว)",
  "whyLowerBand": "ราคาแตะกรอบล่าง (มักเป็นจังหวะเด้ง)",
  "whyUpperBand": "ราคาชนกรอบบน",
  "whyMidRange": "ราคาอยู่กลางกรอบ ยังไม่มีสัญญาณชัด",
  "whyCheapPct": "ราคาอยู่ค่อนไปทางถูกของรอบ (~{pct}% ของช่วง ต่ำ→สูง)",
  "whyExpensivePct": "ราคาอยู่ค่อนไปทางแพงของรอบ (~{pct}% ของช่วง ต่ำ→สูง)",
  "whyMidPct": "ราคาอยู่กลางกรอบ (~{pct}% ของช่วง ต่ำ→สูง)",
  "gapNeedInfo": "กรอกราคาสูง/ต่ำของรอบ เพื่อประเมินถูก-แพง",
  "gapNeedInfoWhy": "หรือกด \"ดูกราฟตัวอย่าง (ฝึกอ่าน)\" เพื่อลองเล่นกราฟ — ตอนนี้ทำได้เฉพาะคำนวณเงินด้านล่าง",
  "stopMustBeLower": "ราคาตัดขาดทุนต้องต่ำกว่าราคาเข้าซื้อ",
  "minLotNote": "ขั้นต่ำ 100 หุ้น ทำให้ความเสี่ยงเกิน {pct}% ที่ตั้งไว้เล็กน้อย — พิจารณาขยับ stop ให้แคบลง หรือเพิ่มทุน",
  "capitalLimitNote": "จำกัดจำนวนตามเงินที่มี (ทุนไม่พอซื้อเท่าที่ความเสี่ยงอนุญาต)",
  "calcHeadline": "ควรซื้อได้ประมาณ <b>{shares} หุ้น</b> ({lots} ล็อต) ใช้เงิน ≈ <b>฿{cost}</b>",
  "calcHeadline_us": "ควรซื้อได้ประมาณ <b>{shares} หุ้น</b> ใช้เงิน ≈ <b>{cost}</b>{fx}",
  "kvRiskIfWrong": "ถ้าผิดทาง (แตะ Stop) เสียไม่เกิน",
  "kvStopPrice": "ราคาตัดขาดทุน (Stop)",
  "kvCommRoundtrip": "ค่าคอมฯ จริงไป-กลับ",
  "kvBreakeven": "ราคาคุ้มทุน (รวมค่าคอมฯ ไป-กลับ)",
  "kvRR": "ความคุ้ม (กำไรคาดหวัง : ความเสี่ยง) ถึงแนวต้าน",
  "tpLot1": "ทยอยขายไม้ 1: {price}",
  "tpLot2": "ไม้ 2: {price}",
  "tpLot3": "ไม้ 3: {price}",
  "commMinNote": "ไม้นี้เล็กเกินกว่าค่าคอมฯ ตามเปอร์เซ็นต์จะถึงขั้นต่ำ — โบรกจึงเก็บขั้นต่ำ ฿{min}/วัน แทน ทำให้ค่าคอมฯ จริงคิดเป็น {pct}% ไป-กลับ ต้องขึ้นถึง {breakeven} บาทถึงจะเท่าทุนจริง — ลองซื้อไม้ใหญ่ขึ้นเพื่อเฉลี่ยค่าคอมฯ ให้ถูกลง",
  "trendUpAdx": "อยู่ในแนวโน้มขึ้น (ราคาเหนือเส้นเฉลี่ย)",
  "trendNotUpAdx": "ยังไม่อยู่ในแนวโน้มขึ้น (ราคาใต้เส้นเฉลี่ย)",
  "adxStrongTxt": " · ADX {adx} เทรนด์แข็งแรง",
  "adxWeakTxt": " · ADX {adx} เทรนด์อ่อน ควรระวัง",
  "notChasing": "ไม่ไล่ราคา (ห่างเส้นเฉลี่ย 20 ไม่เกิน 5%)",
  "chasing": "กำลังไล่ราคา (สูงกว่าเส้นเฉลี่ย 20 เกิน 5%)",
  "needChartFirst": "แนวโน้ม/การไล่ราคา: ต้องมีข้อมูลกราฟก่อน (กด \"ดึงราคา\" หรือ \"ดูกราฟตัวอย่าง\")",
  "rsiOk": "ไม่ร้อนแรงเกิน (RSI {rsi})",
  "rsiHot": "ร้อนแรงเกินไป (RSI {rsi} ≥ 70) เสี่ยงย่อ",
  "rsiNeedChart": "RSI: ต้องมีข้อมูลกราฟก่อน",
  "stopSetOk": "ตั้งจุดตัดขาดทุน (Stop) แล้ว",
  "stopNotSet": "ยังไม่ตั้งจุดตัดขาดทุน — กด \"คำนวณ\" ในขั้นที่ 2 ก่อน",
  "riskOk": "เสี่ยงต่อไม้ ≤ 2% ({pct}%)",
  "riskHigh": "เสี่ยงต่อไม้สูงไป ({pct}) — ควร ≤ 2%",
  "rrOk": "กำไรคาดหวัง:เสี่ยง ≥ 2:1 ({rr}:1)",
  "rrLow": "กำไร:เสี่ยงน้อยไป ({rr}:1) — ควร ≥ 2:1",
  "rrNeedInfo": "กำไร:เสี่ยง: ต้องมีแนวต้านจากกราฟ + ตั้ง Stop ก่อน",
  "checklistFail": "ยังไม่ควรเข้า — ติด {n} ข้อ ควรแก้ให้ครบก่อนซื้อ",
  "checklistUnknown": "ข้อมูลไม่พอประเมินครบ — กด \"ประเมิน\"/\"ดึงราคา\" แล้ว \"คำนวณ\" ก่อน",
  "checklistGo": "เข้าได้ตามแผน — ผ่านครบทุกข้อ (แต่ยังไม่การันตีกำไร ทำตามแผนและตัดขาดทุนเสมอ)",
  "sellSarDn": "พิจารณาขาย — สัญญาณเทรนด์กลับตัว (SAR พลิกลง)",
  "sellBelowTrend": "พิจารณาขาย/ตัดขาดทุน — ราคาหลุดแนวโน้ม (ต่ำกว่าเส้นค่าเฉลี่ย)",
  "sellHotRsi": "พิจารณาล็อกกำไรบางส่วน — RSI สูง ราคาร้อนแรง อาจย่อ",
  "sellNearResist": "ใกล้แนวต้าน — พิจารณาล็อกกำไรบางส่วน",
  "sellHold": "ยังอยู่ในแนวโน้มขึ้น — ถือต่อได้ เลื่อนจุดตัดขาดทุนตามแนวด้านล่าง",
  "sarLabel": "แนวตัดขาดทุนตามเทรนด์ (SAR)",
  "sarNoData": "ข้อมูลไม่พอคำนวณ (ต้องมีประวัติราคาอย่างน้อย ~3 วัน)",
  "sarUpReason": "ถ้าราคาปิดหลุดต่ำกว่า {price} ถือว่าเทรนด์ขาขึ้นเริ่มกลับตัว",
  "sarUpReason_us": "ถ้าราคาปิดหลุดต่ำกว่า {sar} ถือว่าเทรนด์ขาขึ้นเริ่มกลับตัว",
  "sarDnReason": "ราคาหลุดแนวนี้ไปแล้ว (SAR พลิกลง) — เป็นสัญญาณเตือนที่ชัดที่สุด",
  "stopRiskLabel": "จุดตัดขาดทุนตามความเสี่ยง (ATR/แนวรับ)",
  "noData": "ข้อมูลไม่พอคำนวณ",
  "stopRiskReason": "กันขาดทุนหนักถ้าราคาหลุดแนวรับหรือผันผวนเกินค่าเฉลี่ย{atr}",
  "atrSuffix": " (ATR ≈ {atr})",
  "ema20Label": "เส้นค่าเฉลี่ย 20 วัน (สัญญาณเตือนแรก)",
  "ema20Reason": "หลุดเส้นนี้มักเป็นสัญญาณเริ่มอ่อนตัว — ยังไม่ใช่จุดตัดขาดทุนหลัก แต่ควรเริ่มระวัง",
  "resistLabel": "แนวต้าน (จุดพิจารณาล็อกกำไรบางส่วน)",
  "resistReason": "ราคามักเจอแรงขายทำกำไรบริเวณนี้ พิจารณาขายบางส่วนหรือเลื่อนจุดตัดขาดทุนตามเพื่อป้องกันกำไร",
  "noCompanyInfo": "ไม่มีข้อมูลบริษัทในฐานข้อมูล",
  "companyInfoFallback": "รองรับเฉพาะ 50 หุ้นใน SET50 — <a href=\"{url}\" target=\"_blank\" rel=\"noopener\">ค้นหาข้อมูลบริษัท {sym} เอง ↗</a>",
  "companyInfoFallback_us": "รองรับเฉพาะหุ้นในรายการที่มีข้อมูล — <a href=\"{url}\" target=\"_blank\" rel=\"noopener\">ค้นหาข้อมูลบริษัท {sym} เอง ↗</a>",
  "alertEnterSym": "ใส่ชื่อหุ้นก่อน",
  "alertEnterValid": "กรอกจำนวนหุ้นและราคาต้นทุนให้ถูกต้อง",
  "fetchingSellPrice": "กำลังดึงราคา {sym}…",
  "sellFetchFail": "ดึงราคา {sym} ไม่ได้ตอนนี้ — ลองใหม่อีกครั้ง หรือกรอกราคาปัจจุบันเองในช่อง",
  "sellLatestPrice": "ราคาล่าสุด {price}",
  "sellSavedAge": " (บันทึกไว้ {age})",
  "sellCostLabel": " · ต้นทุน {cost} · ",
  "sellProfit": "กำไร ",
  "sellLoss": "ขาดทุน ",
  "searchNewsMyself": "ค้นหาข่าวเอง ↗",
  "searchingNews": "กำลังค้นข่าว {sym}… ",
  "moreNews": "ดูข่าวเพิ่มเติม ",
  "newsAutoFail": "ดึงข่าวอัตโนมัติไม่ได้ตอนนี้ ",
  "iosNotSupported": "ฟีเจอร์นี้ (AI รันในเครื่อง) ยังไม่รองรับ iPhone/iPad ตอนนี้ — หน่วยความจำต่อแท็บของ Safari/iOS จำกัดเกินกว่าจะรันโมเดลได้อย่างเสถียร ลองใช้งานจากคอมพิวเตอร์แทนได้ครับ",
  "needStockData": "ยังไม่มีข้อมูลหุ้นให้สรุป — ดึงราคาหรือดูกราฟตัวอย่างก่อนนะครับ",
  "summarizing": "กำลังสรุป… (ครั้งแรกอาจต้องโหลดโมเดล AI ~350MB ก่อน)",
  "loadingModel": "กำลังโหลดโมเดล (ครั้งแรกเท่านั้น) {file} {pct}",
  "summarizeFail": "สรุปไม่สำเร็จ ลองอีกครั้ง",
  "summarizeFailWith": "สรุปไม่สำเร็จ: {msg}",
  "unknownReason": "ไม่ทราบสาเหตุ",
  "memErrorMsg": "โหลดโมเดล AI ไม่สำเร็จ เพราะหน่วยความจำที่เบราว์เซอร์เหลือให้ใช้ไม่พอ (มักเกิดถ้าเปิดแท็บ/โปรแกรมอื่นพร้อมกันเยอะ) ลองปิดแท็บ/โปรแกรมอื่นแล้วกดสรุปใหม่อีกครั้ง",
  "diskErrorMsg": "บันทึกไฟล์โมเดล AI ไม่สำเร็จ เพราะพื้นที่จัดเก็บของเบราว์เซอร์สำหรับเว็บไซต์นี้เต็ม (คนละเรื่องกับโปรแกรม/แท็บอื่นที่เปิดอยู่) ลองล้างข้อมูลเว็บไซต์นี้ในเบราว์เซอร์ หรือเพิ่มพื้นที่ว่างในดิสก์แล้วลองใหม่",
  "thisStock": "หุ้นนี้",
  "sampleWord": "ตัวอย่าง",
  "enterEntryFirst": "กรอกราคาเข้าซื้อ (หรือราคาตอนนี้) ก่อน",
  "ctxStock": "หุ้น: {v}",
  "ctxLatestPrice": "ราคาล่าสุด: {v} บาท",
  "ctxLatestPrice_us": "ราคาล่าสุด: {v} ดอลลาร์สหรัฐฯ",
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
  "ctxNewsWithCount": "หัวข้อข่าวล่าสุด ({n} ข่าว): {v}",
  "ctxNoNews": "หัวข้อข่าวล่าสุด: ไม่มีข้อมูลข่าว",
  "gatewayUrlLabel": "Gateway URL",
  "fxSummary": "แปลงเป็นเงินบาท (ทางเลือก)",
  "fxRateLabel": "อัตราแลกเปลี่ยน",
  "fxRatePh": "เช่น 36.00",
  "unitBahtPerUsd": "(บาทต่อ 1 USD)",
  "fxFetchBtn": "ดึงอัตราปัจจุบัน",
  "fxShowLabel": "แสดงยอดเทียบเงินบาท (≈ ฿) ในหน้านี้",
  "fxFetching": "กำลังดึงอัตราแลกเปลี่ยน…",
  "fxFromYahoo": "อัตราจาก Yahoo Finance (THB=X) · เมื่อสักครู่",
  "fxUsingSaved": "ดึงสดไม่ได้ — ใช้อัตราที่บันทึกไว้ ({age})",
  "fxAutoFail": "ดึงอัตโนมัติไม่ได้ตอนนี้ — กรอกอัตราแลกเปลี่ยนเองด้านบน",
  "perShareAtRate": "≈ {v} ต่อหุ้น (ตามอัตราที่ตั้งไว้)",
  "detNoData": "—",
  "minShareNote": "ขั้นต่ำ 1 หุ้น ทำให้ความเสี่ยงเกิน {riskPct}% ที่ตั้งไว้เล็กน้อย — พิจารณาขยับ stop ให้แคบลง หรือเพิ่มทุน",
  "summarizeCached": "ผลสรุปนี้คำนวณไว้แล้ว (โหลดจากแคช ไม่ต้องเรียก AI ใหม่)",
  "crumbHome": "การลงทุน",
  "crumbStock": "หุ้น",
  "tabTh": "หุ้นไทย",
  "tabUs": "หุ้นต่างประเทศ",
  "tabScan": "สแกนเนอร์",
  "tabPaper": "พอร์ตจำลอง",
  "journalBtn": "สมุดเทรด →",
  "defaultSector_us": "หุ้นต่างประเทศ"
 },
 "en": {
  "whyTitleDefault": "Reason for signal",
  "defaultSignal": "Signal —",
  "defaultSector": "Thai stock",
  "step1Title": "Current stock price",
  "symLabel": "Ticker (e.g. PTT, ADVANC)",
  "symLabel_us": "Ticker (e.g. AAPL, MSFT)",
  "fetchBtn": "Try Fetching Price",
  "fetchBtn_us": "Try fetching price",
  "priceNowLabel": "Current price (THB)",
  "priceNowLabel_us": "Current price (USD)",
  "priceNowPh": "e.g. 35.50",
  "priceNowPh_us": "e.g. 180.50",
  "priceHiLabel": "Period high",
  "priceLoLabel": "Period low",
  "periodPh": "Last 3 months",
  "periodPh_us": "3-month range",
  "liveModeHistorical": "Data mode: Historical",
  "refreshBtn": "Refresh",
  "marketSettingsBtn": "Market Data Settings",
  "marketSettingsTitle": "Live Market Data",
  "providerLabel": "Data source",
  "providerGateway": "Tanot Data Gateway (recommended)",
  "providerYahoo": "Yahoo / Historical",
  "apiKeyLabel": "Twelve Data API Key",
  "apiKeyNote": "(stored locally only)",
  "apiKeyPh": "Enter if you have an API key",
  "intervalLabel": "Refresh every",
  "interval5": "5 seconds",
  "interval10": "10 seconds",
  "interval30": "30 seconds",
  "saveSettingsBtn": "Save Settings",
  "saveSettingsBtn_us": "Save settings",
  "clearApiKeyBtn": "Clear API Key",
  "analyzeBtn": "Analyze It",
  "analyzeBtn_us": "Analyze it for me",
  "demoBtn": "View Sample Chart (Practice)",
  "demoBtn_us": "View sample chart (practice)",
  "pasteSummary": "Paste historical prices manually (optional)",
  "pasteSummary_us": "Paste historical prices yourself (optional)",
  "pasteBtn": "Use This Price",
  "pasteBtn_us": "Use this price",
  "chartTitle": "Price Chart",
  "chartTitle_us": "Price chart",
  "tf1m": "1mo",
  "tf3m": "3mo",
  "tf6m": "6mo",
  "tf1y": "1yr",
  "tgMa20": "MA 20",
  "tgMa50": "MA 50",
  "capUp": "Up candle",
  "capUp_us": "Up bar",
  "capDn": "Down candle",
  "capDn_us": "Down bar",
  "capMa20": "20-day average",
  "capMa20_us": "20-day MA",
  "capMa50": "50-day average",
  "capMa50_us": "50-day MA",
  "techDetailsSummary": "Technical details",
  "techDetailsSummary_us": "View technical details (no need to understand it)",
  "aiSumTitle": "AI Stock Summary",
  "aiSumBtn": "Summarize It",
  "step2Title": "How much to invest, and where to sell",
  "step2Title_us": "If buying, how much to put in and where to sell",
  "capitalLabel": "Total portfolio capital (THB)",
  "capitalLabel_us": "Total portfolio capital (USD)",
  "capitalPh": "e.g. 100000",
  "capitalPh_us": "e.g. 10000",
  "riskPctLabel": "Risk per trade",
  "unitPctPortfolio": "(% of portfolio)",
  "entryLabel": "Entry price (THB)",
  "entryLabel_us": "Entry price (USD)",
  "entryPh": "= current price",
  "stopLabel": "Stop-loss price",
  "stopPh": "Suggested automatically",
  "stopPh_us": "Auto-suggested",
  "commLabel": "Commission",
  "unitPctPerTrade": "(% per trade)",
  "commMinLabel": "Minimum commission",
  "unitBahtPerDay": "(THB/day)",
  "calcBtn": "Calculate",
  "saveToPortfolioBtn": "Save to Portfolio",
  "savedBtn": "Saved",
  "checklistTitle": "Pre-Trade Checklist — Should You Buy?",
  "checkBtn": "Run Checklist",
  "pfTitle": "My Portfolio (Thai Stocks)",
  "pfTitle_us": "My Portfolio (Global Stocks)",
  "pfSymLabel": "Ticker",
  "pfSharesLabel": "Shares",
  "pfCostLabel": "Cost/share",
  "pfAddBtn": "Add to Portfolio",
  "pfEmptyDefault": "No holdings yet",
  "pfThSym": "Stock",
  "pfThShares": "Shares",
  "pfThCost": "Cost/share",
  "pfThCur": "Current price",
  "pfThPl": "P/L",
  "pfPricePh": "Price",
  "pfSellTitle": "Check should I sell?",
  "pfSellBtn": "Should I sell?",
  "pfDelTitle": "Delete",
  "stockNewsDefault": "Stock News",
  "stockNewsWithSym": "{sym} News",
  "oppdayLinkText": "Opportunity Day",
  "liveReal": "Live / Real-time",
  "liveFallback": "Fallback / Historical",
  "liveNoConn": "Live data source not reachable yet · using historical price as fallback",
  "liveYahooMeta": "Using Yahoo for historical charts",
  "liveModePrefix": "Data mode: ",
  "updatedAt": "updated ",
  "liveHistorical": "Historical",
  "settingsSaved": "Settings saved · data will refresh at the interval you set",
  "settingsSaved_us": "Settings saved · the system will fetch data at the interval you set",
  "apiKeyCleared": "API Key cleared from this device",
  "typeSymFirst": "Type a ticker first, e.g. PTT",
  "typeSymFirst_us": "Type a ticker first, e.g. AAPL",
  "fetchingData": "Fetching {sym} data…",
  "latestPriceMsg": "Latest price {price} THB · {source} · {time}",
  "liveFromMsg": "Live price for {sym} from {source} · {days} days of history",
  "liveFromMsg_us": "Live {sym} price from {source} · {days}-day historical chart",
  "staleDataMsg": "Live source unavailable · using saved historical data ({age}) · {days} days",
  "histFromMsg": "Currently using historical price from {source} · {days} days",
  "histFromMsg_us": "Currently using historical prices from {source} · {days} days",
  "notFoundMsg": "No data found for {sym} — check the ticker or your market data connection",
  "enterPriceFirst": "Please enter at least the \"current price\" first",
  "chartLibFail": "Couldn’t load the charting library (try going online and refreshing) — the signal light/money calculator still work",
  "chartLibFail_us": "Couldn't load the chart library (try going online then refreshing) — the signal light/money calculator still work",
  "pasteAtLeast5": "Please paste at least 5 days of closing prices",
  "pastedMsg": "Using pasted price ({days} days)",
  "pastedMsg_us": "Using pasted prices ({days} days)",
  "demoMsg": "Showing \"sample data\" (not real prices) — for practicing reading charts",
  "demoMsg_us": "Showing \"sample data\" (not a real price) — for trying the chart and practicing reading it",
  "demoBadge": "Sample data — not real prices (for practicing chart reading)",
  "demoBadge_us": "Sample data — not real prices (for practicing reading charts)",
  "pastedBadge": "Pasted price · {days} days",
  "pastedBadge_us": "Self-pasted prices · {days} days",
  "realBadgeLabel": "Real price",
  "realBadge": "{label} · {status} · {days} days",
  "staleLatestPrice": "Latest price {age}",
  "justNow": "just now",
  "minsAgo": "{n} min ago",
  "hrsAgo": "{n} hr ago",
  "daysAgo": "{n} days ago",
  "legendOpen": "Open",
  "legendHigh": "High",
  "legendLow": "Low",
  "legendClose": "Close",
  "detEma20": "20-day average (EMA20)",
  "detEma20_us": "20-day MA (EMA20)",
  "detEma50": "50-day average (EMA50)",
  "detEma50_us": "50-day MA (EMA50)",
  "detRsi": "RSI (14)",
  "detMacd": "MACD histogram",
  "detBbUp": "Upper band (Bollinger)",
  "detBbLo": "Lower band (Bollinger)",
  "detAtr": "ATR (volatility)",
  "detSupport": "Latest support",
  "detResistance": "Latest resistance",
  "detAdx": "Trend strength (ADX 14)",
  "detAdxStrong": " · strong",
  "detAdxWeak": " · weak",
  "detSar": "Trailing stop (Parabolic SAR)",
  "detSarUp": " · uptrend",
  "detSarDn": " · downtrend",
  "vGood": "Interesting — worth considering",
  "vBad": "Caution — not the right time yet",
  "vWait": "Wait — no standout opportunity yet",
  "vExpensive": "Caution — price is on the expensive side",
  "vExpensive_us": "Careful — price is fairly expensive",
  "vMid": "Wait — price is mid-range",
  "whyCheap": "Price is on the cheap side of its 3-month range",
  "whyExpensive": "Price is on the expensive side of its 3-month range",
  "whySellEase": "Selling pressure easing (RSI low, starting to recover)",
  "whyHot": "Price is overheated (RSI high, risk of pullback)",
  "whyMomUp": "Momentum is turning positive",
  "whyMomDn": "Momentum is weakening",
  "whyUptrend": "Still in an uptrend",
  "whyDowntrend": "Below the trend line (downtrend/consolidation)",
  "whyLowerBand": "Price is touching the lower band (often a bounce opportunity)",
  "whyUpperBand": "Price is hitting the upper band",
  "whyMidRange": "Price is mid-range with no clear signal yet",
  "whyCheapPct": "Price is on the cheap side of its range (~{pct}% of low→high range)",
  "whyCheapPct_us": "Price is toward the cheap end of the range (~{pct}% of low→high)",
  "whyExpensivePct": "Price is on the expensive side of its range (~{pct}% of low→high range)",
  "whyExpensivePct_us": "Price is toward the expensive end of the range (~{pct}% of low→high)",
  "whyMidPct": "Price is mid-range (~{pct}% of low→high range)",
  "whyMidPct_us": "Price is in the middle of the range (~{pct}% of low→high)",
  "gapNeedInfo": "Enter the period high/low to assess cheap-vs-expensive",
  "gapNeedInfo_us": "Enter the period high/low to assess cheap vs. expensive",
  "gapNeedInfoWhy": "Or click \"View Sample Chart\" to try the chart — for now only the money calculator below works",
  "gapNeedInfoWhy_us": "Or click \"View sample chart (practice)\" to try the chart — for now only the money calculator below is available",
  "stopMustBeLower": "Stop-loss price must be lower than the entry price",
  "stopMustBeLower_us": "The stop-loss price must be lower than the entry price",
  "minLotNote": "Minimum 100 shares means your risk slightly exceeds the {pct}% you set — consider tightening the stop, or adding capital",
  "capitalLimitNote": "Limited by available funds (not enough capital to buy as much as your risk setting allows)",
  "capitalLimitNote_us": "Limited by available funds (not enough capital to buy as much as the risk setting allows)",
  "calcHeadline": "You can buy about <b>{shares} shares</b> ({lots} lots), using ≈ <b>฿{cost}</b>",
  "calcHeadline_us": "You should buy about <b>{shares} shares</b>, using ≈ <b>{cost}</b>{fx}",
  "kvRiskIfWrong": "If wrong (stop hit), lose no more than",
  "kvRiskIfWrong_us": "If wrong (hits Stop), you lose no more than",
  "kvStopPrice": "Stop-loss price",
  "kvCommRoundtrip": "Real round-trip commission",
  "kvBreakeven": "Breakeven price (incl. round-trip commission)",
  "kvBreakeven_us": "Break-even price (incl. round-trip commission)",
  "kvRR": "Reward:risk to resistance",
  "tpLot1": "Sell lot 1: {price}",
  "tpLot2": "Lot 2: {price}",
  "tpLot3": "Lot 3: {price}",
  "commMinNote": "This trade is too small for the percentage commission to reach the minimum — your broker charges the ฿{min}/day minimum instead, making real commission {pct}% round-trip. Price needs to reach {breakeven} THB to truly break even — consider a bigger trade to average out the minimum commission",
  "trendUpAdx": "In an uptrend (price above moving average)",
  "trendNotUpAdx": "Not yet in an uptrend (price below moving average)",
  "adxStrongTxt": " · ADX {adx} strong trend",
  "adxWeakTxt": " · ADX {adx} weak trend, be careful",
  "notChasing": "Not chasing the price (within 5% of the 20-day average)",
  "chasing": "Chasing the price (more than 5% above the 20-day average)",
  "needChartFirst": "Trend/chase check: needs chart data first (click \"Fetch Price\" or \"View Sample Chart\")",
  "rsiOk": "Not overheated (RSI {rsi})",
  "rsiHot": "Overheated (RSI {rsi} ≥ 70), risk of pullback",
  "rsiNeedChart": "RSI: needs chart data first",
  "stopSetOk": "Stop-loss is set",
  "stopNotSet": "Stop-loss not set yet — click \"Calculate\" in step 2 first",
  "riskOk": "Risk per trade ≤ 2% ({pct}%)",
  "riskHigh": "Risk per trade too high ({pct}) — should be ≤ 2%",
  "rrOk": "Reward:risk ≥ 2:1 ({rr}:1)",
  "rrLow": "Reward:risk too low ({rr}:1) — should be ≥ 2:1",
  "rrNeedInfo": "Reward:risk: needs resistance from the chart + a stop set first",
  "checklistFail": "Not ready to enter — {n} item(s) failed, fix them all before buying",
  "checklistUnknown": "Not enough data to fully assess — click \"Analyze\"/\"Fetch Price\" then \"Calculate\" first",
  "checklistGo": "Ready to enter per plan — all items passed (still not a profit guarantee, follow your plan and always cut losses)",
  "checklistGo_us": "Ready to enter per plan — all items passed (still no profit guarantee — follow the plan and always cut losses)",
  "sellSarDn": "Consider selling — trend reversal signal (SAR flipped down)",
  "sellBelowTrend": "Consider selling/cutting loss — price broke below trend (below moving average)",
  "sellBelowTrend_us": "Consider selling/cutting losses — price broke the trend (below the moving averages)",
  "sellHotRsi": "Consider locking in partial profit — RSI high, price overheated, may pull back",
  "sellHotRsi_us": "Consider locking in some profit — RSI high, price overheated, may pull back",
  "sellNearResist": "Near resistance — consider locking in partial profit",
  "sellNearResist_us": "Near resistance — consider locking in some profit",
  "sellHold": "Still in an uptrend — can keep holding, trail your stop along the levels below",
  "sellHold_us": "Still in an uptrend — can keep holding, trail your stop-loss along the levels below",
  "sarLabel": "Trend-following stop (SAR)",
  "sarNoData": "Not enough data to calculate (needs at least ~3 days of price history)",
  "sarUpReason": "If price closes below {price}, the uptrend is considered to be reversing",
  "sarUpReason_us": "If the closing price falls below {sar}, the uptrend is considered to be reversing",
  "sarDnReason": "Price has already broken this level (SAR flipped down) — the clearest warning signal",
  "stopRiskLabel": "Risk-based stop-loss (ATR/support)",
  "noData": "Not enough data to calculate",
  "stopRiskReason": "Limits heavy losses if price breaks support or is more volatile than average{atr}",
  "stopRiskReason_us": "Protects against a large loss if price breaks support or moves more than average{atr}",
  "atrSuffix": " (ATR ≈ {atr})",
  "ema20Label": "20-day moving average (early warning)",
  "ema20Label_us": "20-day MA (first warning signal)",
  "ema20Reason": "Breaking below this line is often an early weakening signal — not the main stop, but worth watching",
  "ema20Reason_us": "Breaking below this line is often an early weakening signal — not the main stop-loss, but time to be more careful",
  "resistLabel": "Resistance (consider partial profit-taking)",
  "resistLabel_us": "Resistance (point to consider locking in some profit)",
  "resistReason": "Price often meets profit-taking selling pressure here — consider selling part of the position or trailing your stop to protect gains",
  "resistReason_us": "Price often meets profit-taking selling around here — consider selling part of the position or trailing your stop to protect the gain",
  "noCompanyInfo": "No company info in the database",
  "companyInfoFallback": "Only 50 SET50 stocks are supported — <a href=\"{url}\" target=\"_blank\" rel=\"noopener\">search for {sym} company info yourself ↗</a>",
  "companyInfoFallback_us": "Only stocks in the reference list are supported — <a href=\"{url}\" target=\"_blank\" rel=\"noopener\">search for {sym} company info yourself ↗</a>",
  "alertEnterSym": "Enter a ticker first",
  "alertEnterValid": "Enter a valid share count and cost",
  "fetchingSellPrice": "Fetching {sym} price…",
  "sellFetchFail": "Couldn’t fetch {sym} price right now — try again, or enter the current price yourself",
  "sellFetchFail_us": "Couldn't fetch {sym} price right now — try again, or enter the current price yourself",
  "sellLatestPrice": "Latest price {price}",
  "sellSavedAge": " (saved {age})",
  "sellCostLabel": " · cost {cost} · ",
  "sellProfit": "profit ",
  "sellLoss": "loss ",
  "searchNewsMyself": "Search news myself ↗",
  "searchingNews": "Searching news for {sym}… ",
  "moreNews": "More news ",
  "newsAutoFail": "Couldn’t auto-fetch news right now ",
  "newsAutoFail_us": "Couldn't auto-fetch news right now ",
  "iosNotSupported": "This feature (on-device AI) isn’t supported on iPhone/iPad yet — Safari/iOS per-tab memory is too limited to run the model reliably. Try from a computer instead",
  "needStockData": "No stock data to summarize yet — fetch a price or view the sample chart first",
  "summarizing": "Summarizing… (first time may need to download the ~350MB AI model)",
  "loadingModel": "Loading model (first time only) {file} {pct}",
  "summarizeFail": "Summary failed, try again",
  "summarizeFailWith": "Summary failed: {msg}",
  "unknownReason": "unknown reason",
  "memErrorMsg": "Failed to load the AI model because the browser doesn’t have enough free memory (usually from having many tabs/programs open at once). Try closing other tabs/programs and summarizing again",
  "diskErrorMsg": "Failed to save the AI model file because this site’s browser storage is full (unrelated to other open tabs/programs). Try clearing this site’s data in your browser, or free up disk space, then try again",
  "thisStock": "this stock",
  "sampleWord": "Sample",
  "enterEntryFirst": "Enter the entry price (or current price) first",
  "ctxStock": "Stock: {v}",
  "ctxLatestPrice": "Latest price: {v} baht",
  "ctxLatestPrice_us": "Latest price: {v} USD",
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
  "ctxNewsWithCount": "Latest headlines ({n} articles): {v}",
  "ctxNoNews": "Latest headlines: no news data",
  "gatewayUrlLabel": "Gateway URL",
  "fxSummary": "Convert to Thai baht (optional)",
  "fxRateLabel": "Exchange rate",
  "fxRatePh": "e.g. 36.00",
  "unitBahtPerUsd": "(baht per 1 USD)",
  "fxFetchBtn": "Fetch current rate",
  "fxShowLabel": "Show baht-equivalent amounts (≈ ฿) on this page",
  "fxFetching": "Fetching exchange rate…",
  "fxFromYahoo": "Rate from Yahoo Finance (THB=X) · just now",
  "fxUsingSaved": "Live fetch failed — using saved rate ({age})",
  "fxAutoFail": "Couldn't auto-fetch right now — enter the exchange rate yourself above",
  "perShareAtRate": "≈ {v} per share (at the rate you set)",
  "detNoData": "—",
  "minShareNote": "Minimum 1 share, which makes the risk slightly exceed the {riskPct}% you set — consider tightening the stop, or adding capital",
  "summarizeCached": "Already summarized (loaded from cache — no new AI call needed)",
  "crumbHome": "Investing",
  "crumbStock": "Stocks",
  "tabTh": "Thai stocks",
  "tabUs": "Global stocks",
  "tabScan": "Scanner",
  "tabPaper": "Paper portfolio",
  "journalBtn": "Trade journal →",
  "defaultSector_us": "Global stock"
 }
};

  /* ── i18n: t(key) ลองคีย์เฉพาะตลาด key_us ก่อน ── */
  var L = IC.i18n(DICT);
  function t(key, vars) {
    if (market !== 'th') { var d = DICT[IC.getLang()] || DICT.th; if (d[key + '_' + market] != null || DICT.th[key + '_' + market] != null) return L.t(key + '_' + market, vars); }
    return L.t(key, vars);
  }
  /* ข้อความสถานะที่ต้องเปลี่ยนภาษาตามทันที: tl(key, vars) เก็บคีย์ไว้ แปลตอนแสดง/สลับภาษา */
  function tl(key, vars) { return { toString: function () { return t(key, vars); } }; }
  function applyStaticI18n() {
    [].forEach.call(document.querySelectorAll('[data-i18n]'), function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    [].forEach.call(document.querySelectorAll('[data-i18n-html]'), function (el) { el.innerHTML = t(el.getAttribute('data-i18n-html')); });
    [].forEach.call(document.querySelectorAll('[data-i18n-placeholder]'), function (el) { el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder'))); });
  }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }
  function fmt(n, d) { return IC.fmt(n, d); }
  function fmt0(n) { return isFinite(n) ? Math.round(n).toLocaleString('th-TH') : '—'; }
  function esc(s) { return IC.esc(s); }
  function baht(n) { if (!isFinite(n)) return '—'; return (n < 0 ? '−' : '') + '฿' + Math.round(Math.abs(n)).toLocaleString('th-TH'); }
  function usd0(n) { if (!isFinite(n)) return '—'; return (n < 0 ? '−' : '') + '$' + Math.abs(n).toLocaleString('th-TH', { maximumFractionDigits: 0 }); }
  function money0(n) { return M.ccy === 'USD' ? usd0(n) : baht(n); }
  function cacheAgeText(ts) { return IC.ago(ts); }

  var lastSeries = null, lastAnalysis = null, lastNewsItems = null, lastSource = { kind: 'real' }, lastLive = null;

  /* ── รหัสจาก InvestCalc → ข้อความ ── */
  var WHY_KEY = { cheapRange: 'whyCheap', expensiveRange: 'whyExpensive', rsiLow: 'whySellEase', rsiHigh: 'whyHot', momUp: 'whyMomUp', momDn: 'whyMomDn',
    uptrend: 'whyUptrend', downtrend: 'whyDowntrend', bbLow: 'whyLowerBand', bbHigh: 'whyUpperBand', neutral: 'whyMidRange' };
  function whyText(code, a) {
    if (code === 'cheapPct') return t('whyCheapPct', { pct: a.pct });
    if (code === 'expensivePct') return t('whyExpensivePct', { pct: a.pct });
    if (code === 'midPct') return t('whyMidPct', { pct: a.pct });
    return t(WHY_KEY[code] || 'whyMidRange');
  }
  function verdictText(a) {
    if (a.simple) return t(a.light === 'green' ? 'vGood' : a.light === 'red' ? 'vExpensive' : 'vMid');
    return t(a.light === 'green' ? 'vGood' : a.light === 'red' ? 'vBad' : 'vWait');
  }
  /* วิเคราะห์ → ใส่ข้อความที่หน้าเอง (หน้าแสดงผลอ่านฟิลด์ verdict/why/pros/cons เหมือนเดิม) */
  function decorate(a) {
    a.verdict = a.light === 'gray' ? a.verdict : verdictText(a);
    if (!a.simple) { a.why = whyText(a.why, a); a.prosT = a.pros.map(function (c) { return whyText(c, a); }); a.consT = a.cons.map(function (c) { return whyText(c, a); }); }
    else { a.why = whyText(a.why, a); a.prosT = []; a.consT = []; }
    return a;
  }
  function analyze(s) { var a = Calc.analyzeSeries(s); a.__raw = true; return decorate(a); }

  /* ── ดึงราคา ── */
  function yahooOf(sym) { return sym + M.suffix; }
  function getSeries(sym) { return IC.series(yahooOf(sym)); }

  /* ══ กราฟ lightweight-charts ══ */
  var LWC = null, chart = null, candle = null, volS = null, ma20S = null, ma50S = null, rsiChart = null, rsiS = null;
  var fullData = null, curTF = 63, tg = { ma20: true, ma50: true, vol: true, rsi: false }, syncing = false, themeObs = null;
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
  function fmtDate(tm) {
    if (typeof tm === 'string') { var p = tm.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
    if (tm && tm.year) return tm.day + '/' + tm.month + '/' + tm.year; return String(tm);
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
  function buildChart(data) {
    if (!window.LightweightCharts) return false;
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
    applyTF(curTF); applyToggles();
    if (!themeObs) { themeObs = true; CT.onChange(recolor); }
    setupResize();
    if (window.requestAnimationFrame) requestAnimationFrame(reflow);
    setTimeout(reflow, 120);
    return true;
  }
  function destroyChart() {
    if (chart) { try { chart.remove(); } catch (e) {} chart = null; }
    if (rsiChart) { try { rsiChart.remove(); } catch (e) {} rsiChart = null; rsiS = null; }
    fullData = null; $('chartCard').style.display = 'none';
  }
  function reflow() {
    var el = $('lwChart');
    if (chart && el) { try { chart.applyOptions({ width: chartWidth(el) }); chart.timeScale().fitContent(); } catch (e) {} }
    var er = $('lwRsi');
    if (rsiChart && er) { try { rsiChart.applyOptions({ width: chartWidth(er) }); rsiChart.timeScale().fitContent(); } catch (e) {} }
  }
  var resizeWired = false;
  function setupResize() {
    if (resizeWired) return; resizeWired = true;
    window.addEventListener('resize', reflow);
    if ('ResizeObserver' in window) { try { new ResizeObserver(reflow).observe($('lwChart')); } catch (e) {} }
  }

  /* ══ ป้อนชุดข้อมูล → วิเคราะห์ + วาดกราฟ ══ */
  var statusKeep = '', statusCls = '';
  function setStatus(msg, cls) { statusKeep = msg; statusCls = cls; var el = $('fetchStatus'); el.textContent = String(msg == null ? '' : msg); el.className = 'status' + (cls ? ' ' + cls : ''); }
  function setSourceBadge(src, days) {
    var el = $('chartSource'); if (!el) return;
    if (src) lastSource = src; else src = lastSource;
    if (src.kind === 'demo') { el.className = 'badge wrap warn'; el.textContent = t('demoBadge'); }
    else if (src.kind === 'paste') { el.className = 'badge wrap'; el.textContent = t('pastedBadge', { days: days }); }
    else { el.className = 'badge wrap ok'; el.textContent = t('realBadge', { label: src.label || t('realBadgeLabel'), status: src.stale ? t('staleLatestPrice', { age: cacheAgeText(src.cachedAt) }) : t('realBadgeLabel'), days: days }); }
  }
  function useSeries(s, msg, cls, src) {
    lastSeries = s;
    var c = s.closes;
    $('price').value = c[c.length - 1].toFixed(2);
    $('hi').value = Math.max.apply(null, c).toFixed(2);
    $('lo').value = Math.min.apply(null, c).toFixed(2);
    if (msg) setStatus(msg, cls);
    setSourceBadge(src, c.length);
    showAnalysis(analyze(s));
    if (!buildChart(s)) setStatus(tl('chartLibFail'), 'err');
    updatePriceFx();
  }
  function companyOf(sym) { return getCompanyInfo(sym); }
  function updateStockHead(sym) {
    $('shead').style.display = 'flex';
    $('stkSym').textContent = sym;
    var c = companyOf(sym);
    $('stkName').textContent = c ? c.name : sym;
    $('stkSector').textContent = c ? c.sector : t('defaultSector');
  }
  function showAnalysis(a) {
    lastAnalysis = a;
    var bulbColors = { green: 'var(--ome-ok)', yellow: 'var(--ome-warn)', red: 'var(--ome-err)' };
    $('verdictDot').style.background = bulbColors[a.light] || 'var(--ome-text-3)';
    $('verdictTxt').textContent = a.verdict;
    $('whyTitle').textContent = a.verdict;
    var lines = [a.why];
    if (a.prosT && a.prosT.length > 1) lines = lines.concat(a.prosT.slice(1));
    if (a.consT && a.consT.length) lines = lines.concat(a.consT);
    $('whyList').innerHTML = lines.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');
    $('px').textContent = fmt(a.price);
    var prevClose = (lastSeries && lastSeries.closes.length > 1) ? lastSeries.closes[lastSeries.closes.length - 2] : NaN;
    if (isFinite(prevClose) && prevClose) {
      var diff = a.price - prevClose, pct = diff / prevClose * 100;
      $('chg').textContent = (diff >= 0 ? '+' : '−') + fmt(Math.abs(diff)) + ' (' + (diff >= 0 ? '+' : '−') + fmt(Math.abs(pct)) + '%)';
      $('chg').className = 'delta ' + (diff >= 0 ? 'up' : 'dn');
    } else { $('chg').textContent = '—'; $('chg').className = 'delta'; }
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
    if (a.light && a.light !== 'gray' && IC.aiAvailable()) {
      $('aiSumCard').style.display = 'block';
      $('aiSumOut').style.display = 'none'; $('aiSumOut').textContent = '';
      setAiStatus('', '');
    } else $('aiSumCard').style.display = 'none';
  }
  function doAnalyze() {
    if (lastSeries) { useSeries(lastSeries); return; }
    var price = num($('price').value), hi = num($('hi').value), lo = num($('lo').value);
    if (!isFinite(price)) { setStatus(tl('enterPriceFirst'), 'err'); return; }
    $('chartCard').style.display = 'none';
    if (isFinite(hi) && isFinite(lo) && hi > lo) showAnalysis(decorate(Calc.analyzeSimple(price, hi, lo)));
    else {
      showAnalysis({ light: 'gray', verdict: t('gapNeedInfo'), why: t('gapNeedInfoWhy'), prosT: [], consT: [], pros: [], cons: [], price: price, suggestStop: price * 0.95, resistance: NaN, det: {}, simple: true });
      $('detailsBox').style.display = 'none';
    }
    updatePriceFx();
  }

  /* ══ Live (Gateway/Twelve Data) — ตั้งค่าในกล่องเดียวของ InvestCore ══ */
  var liveUIArgs = null; // label/meta เป็นข้อความหรือฟังก์ชัน (ฟังก์ชัน = แปลใหม่ตอนสลับภาษา)
  function setLiveUI(kind, label, meta) {
    liveUIArgs = [kind, label, meta];
    var dot = $('marketLiveDot'), title = $('marketLiveLabel'), m = $('marketLiveMeta');
    dot.className = 'market-live-dot ' + (kind === 'live' ? 'live' : kind === 'delay' ? 'delay' : '');
    var val = function (x) { return typeof x === 'function' ? x() : x; };
    title.textContent = t('liveModePrefix') + val(label); m.textContent = val(meta) || '';
  }
  function curSym() { return ($('sym').value || '').trim().toUpperCase().replace(/\.BK$/, ''); }
  function applyLiveQuote(q) {
    lastLive = q;
    var p = $('price'); if (p) { p.value = Number(q.price).toFixed(2); p.dispatchEvent(new Event('input', { bubbles: true })); }
    var e = $('entry'); if (e && !e.value) e.value = Number(q.price).toFixed(2);
    var ch = isFinite(q.change) ? (q.change >= 0 ? '+' : '−') + Number(Math.abs(q.change)).toFixed(2) : '—';
    var pc = isFinite(q.pct) ? ' (' + (q.pct >= 0 ? '+' : '') + Number(q.pct).toFixed(2) + '%)' : '';
    var tm = q.timestamp ? new Date(q.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
    setLiveUI('live', function () { return t('liveReal'); }, function () { return q.source + ' · ' + ch + pc + ' · ' + t('updatedAt') + tm; });
    setStatus(tl('latestPriceMsg', { price: Number(q.price).toFixed(2), source: q.source, time: tm }), 'ok');
  }
  function startLive() {
    IC.live.stop();
    var c = IC.live.cfg();
    if (c.provider === 'yahoo') { setLiveUI('', function () { return t('liveHistorical'); }, function () { return t('liveYahooMeta'); }); return; }
    IC.live.start(curSym, M.live, applyLiveQuote, function (err) {
      var reason = err && err.message;
      setLiveUI('delay', function () { return t('liveFallback'); }, function () { return reason ? (t('liveNoConn') + ' — ' + reason) : t('liveNoConn'); });
    });
  }
  function refreshLive() {
    var c = IC.live.cfg(), sym = curSym();
    if (!sym || c.provider === 'yahoo') { setLiveUI('', t('liveHistorical'), t('liveYahooMeta')); return; }
    IC.live.quote(sym, M.live).then(applyLiveQuote, function (err) { setLiveUI('delay', t('liveFallback'), err && err.message ? t('liveNoConn') + ' — ' + err.message : t('liveNoConn')); });
  }

  function doFetch() {
    var sym = curSym();
    if (!sym) { setStatus(tl('typeSymFirst'), 'err'); return; }
    setStatus(tl('fetchingData', { sym: sym })); $('fetchBtn').disabled = true;
    updateStockHead(sym);
    var c = IC.live.cfg();
    var livePromise = c.provider === 'yahoo' ? Promise.reject(new Error('historical')) : IC.live.quote(sym, M.live);
    livePromise.then(function (q) {
      applyLiveQuote(q);
      return getSeries(sym).then(function (r) { useSeries(r.series, tl('liveFromMsg', { sym: sym, source: q.source, days: r.series.closes.length }), 'ok', { kind: 'real', label: sym }); showStockNews(sym); });
    }).catch(function () {
      return getSeries(sym).then(function (r) {
        var s = r.series;
        if (r.stale) useSeries(s, tl('staleDataMsg', { age: cacheAgeText(r.cachedAt), days: s.closes.length }), 'ok', { kind: 'real', label: sym, stale: true, cachedAt: r.cachedAt });
        else useSeries(s, tl('histFromMsg', { source: 'Yahoo', days: s.closes.length }), 'ok', { kind: 'real', label: sym });
        showStockNews(sym);
      });
    }).catch(function () { setStatus(tl('notFoundMsg', { sym: sym }), 'err'); }).then(function () { $('fetchBtn').disabled = false; });
  }
  function doDemo() { $('stockNewsCard').style.display = 'none'; updateStockHead(t('sampleWord')); useSeries(Calc.demoData(M.key === 'us' ? 150 : 32), tl('demoMsg'), 'ok', { kind: 'demo' }); }
  function doPaste() {
    var s = Calc.parsePaste($('pasteBox').value || '');
    if (!s) { setStatus(tl('pasteAtLeast5'), 'err'); return; }
    $('stockNewsCard').style.display = 'none';
    useSeries(s, tl('pastedMsg', { days: s.closes.length }), 'ok', { kind: 'paste' });
  }

  /* ══ อัตราแลกเปลี่ยน (เฉพาะ #us) — ≈ ฿ ในผลลัพธ์ ══ */
  var fxRate = NaN;
  function fxOn() { return market === 'us' && !!($('fxShowChk') && $('fxShowChk').checked) && isFinite(fxRate) && fxRate > 0; }
  function fxSpan(n) { return (fxOn() && isFinite(n)) ? (' <span class="fx-sub">(≈ ' + baht(n * fxRate) + ')</span>') : ''; }
  function updatePriceFx() {
    var el = $('priceFx'); if (!el) return;
    var p = num($('price').value);
    el.textContent = (fxOn() && isFinite(p)) ? t('perShareAtRate', { v: baht(p * fxRate) }) : '';
  }
  function setFxStatus(msg, cls) { var el = $('fxStatus'); if (el) { el.textContent = msg; el.className = 'status' + (cls ? ' ' + cls : ''); } }
  function doFxFetch() {
    setFxStatus(t('fxFetching'));
    IC.fx('USD', { force: true }).then(function (r) {
      fxRate = r.rate; $('fxRate').value = r.rate.toFixed(2);
      setFxStatus(r.stale ? t('fxUsingSaved', { age: cacheAgeText(r.ts) }) : t('fxFromYahoo'), 'ok');
      updatePriceFx(); if ($('riskResult').classList.contains('show')) doCalc(); renderPf();
    }, function () { setFxStatus(t('fxAutoFail'), 'err'); });
  }

  /* ══ ข่าวหุ้นตัวที่กำลังดู ══ */
  var newsSym = null;
  function showStockNews(sym) {
    newsSym = sym;
    $('stockNewsCard').style.display = 'block';
    $('stockNewsTitle').textContent = t('stockNewsWithSym', { sym: sym });
    $('oppdayRow').style.display = market === 'th' ? '' : 'none';
    renderNewsBlock($('stockNewsBlock'), sym, true);
  }
  function renderNewsBlock(el, sym, main) {
    if (!el) return;
    if (main) lastNewsItems = null;
    var q = M.newsQ(sym);
    var link = '<a class="news-search-link" target="_blank" rel="noopener" href="' + esc(IC.newsSearchUrl(q)) + '">' + t('searchNewsMyself') + '</a>';
    el.innerHTML = t('searchingNews', { sym: esc(sym) }) + link;
    IC.news(q, { limit: 5, maxAge: 8 * 3600000 }).then(function (r) {
      el.innerHTML = '<ul class="news-list">' + r.items.map(function (n) {
        return '<li><a href="' + esc(n.link) + '" target="_blank" rel="noopener">' + esc(n.title) + '</a><span class="news-date">' + esc(IC.newsDate(n.pubDate)) + '</span></li>';
      }).join('') + '</ul>' + t('moreNews') + link;
      if (main) lastNewsItems = r.items;
    }, function () { el.innerHTML = t('newsAutoFail') + link; });
  }

  /* ══ สรุปด้วย AI (คลาวด์อย่างเดียว) ══ */
  function setAiStatus(text, cls) { var el = $('aiSumStatus'); if (!el) return; el.textContent = text || ''; el.className = 'status' + (cls ? ' ' + cls : ''); }
  function buildStockContext() {
    var a = lastAnalysis; if (!a || !a.det) return null;
    var sym = (lastSource && lastSource.label) ? lastSource.label : (curSym() || t(market === 'us' ? 'thisStockFallback' : 'thisStock'));
    var lines = [t('ctxStock', { v: sym }), t('ctxLatestPrice', { v: fmt(a.price) }), t('ctxVerdict', { v: a.verdict, why: a.why })];
    if (a.prosT && a.prosT.length) lines.push(t('ctxPros', { v: a.prosT.join(', ') }));
    if (a.consT && a.consT.length) lines.push(t('ctxCons', { v: a.consT.join(', ') }));
    var d = a.det || {};
    if (isFinite(d.rsi)) lines.push(t('ctxRsi', { v: fmt(d.rsi, 1) }) + (d.rsi > 70 ? t('ctxRsiHigh') : d.rsi < 38 ? t('ctxRsiLow') : t('ctxRsiMid')));
    if (isFinite(d.macdHist)) lines.push(t('ctxMacd', { v: fmt(d.macdHist, 3) }) + (d.macdHist >= 0 ? t('ctxMacdPos') : t('ctxMacdNeg')));
    if (isFinite(d.ema20) && isFinite(d.ema50)) lines.push(t('ctxEma', { e20: fmt(d.ema20), e50: fmt(d.ema50) }) + (a.uptrend ? t('ctxEmaUp') : t('ctxEmaDn')));
    if (isFinite(d.support)) lines.push(t('ctxSupport', { v: fmt(d.support) }));
    if (isFinite(d.resistance)) lines.push(t('ctxResistance', { v: fmt(d.resistance) }));
    if (isFinite(d.adx)) lines.push(t('ctxAdx', { v: fmt(d.adx, 0) }) + (d.adx >= 20 ? t('ctxAdxStrong') : t('ctxAdxWeak')));
    if (lastNewsItems && lastNewsItems.length) lines.push(t('ctxNewsWithCount', { n: lastNewsItems.length, v: lastNewsItems.slice(0, 5).map(function (n) { return n.title; }).join(' / ') }));
    else lines.push(t('ctxNoNews'));
    return lines.join('\n');
  }
  var aiBusy = false;
  function doAiSummary() {
    if (aiBusy) return;
    var ctx = buildStockContext();
    if (!ctx) { setAiStatus(t('needStockData'), 'err'); return; }
    aiBusy = true; $('aiSumBtn').disabled = true; $('aiSumOut').style.display = 'none'; $('aiSumOut').textContent = ''; setAiStatus(t('summarizing'), '');
    var en = IC.getLang() === 'en';
    IC.summarize({ task: M.aiTask, messages: [
      { role: 'system', content: en ? AI_SUMMARY_SYSTEM_PROMPT_EN : AI_SUMMARY_SYSTEM_PROMPT },
      { role: 'user', content: ctx },
      { role: 'system', content: en ? AI_SUMMARY_REMINDER_EN : AI_SUMMARY_REMINDER }
    ] }).then(function (text) {
      if (!text) setAiStatus(t('summarizeFail'), 'err');
      else { $('aiSumOut').style.display = 'block'; $('aiSumOut').textContent = text; setAiStatus('', ''); }
    }, function (err) { setAiStatus(t('summarizeFailWith', { msg: IC.aiMessage(err) }), 'err'); })
      .then(function () { aiBusy = false; $('aiSumBtn').disabled = false; });
  }

  /* ══ ข้อมูลบริษัท (SET50) ══ */
  function companyTables() {
    return market === 'th' ? { th: COMPANY_INFO, en: COMPANY_INFO_EN, fth: SECTOR_FACTORS, fen: SECTOR_FACTORS_EN }
      : { th: US_COMPANY_INFO, en: US_COMPANY_INFO_EN, fth: US_SECTOR_FACTORS, fen: US_SECTOR_FACTORS_EN };
  }
  function getCompanyInfo(sym) { var T = companyTables(); return (IC.getLang() === 'en' ? T.en : T.th)[sym]; }
  function companyInfoUrl(sym) { return 'https://www.google.com/search?q=' + encodeURIComponent(sym + ' บริษัท ทำธุรกิจอะไร'); }
  function companyInfoHtml(sym) {
    var c = getCompanyInfo(sym), T = companyTables();
    if (!c) return '<div class="company-card"><div class="cname">' + t('noCompanyInfo') + '</div><div class="cbiz">' + t('companyInfoFallback', { url: companyInfoUrl(sym), sym: esc(sym) }) + '</div></div>';
    var cTh = T.th[sym];
    var factors = (IC.getLang() === 'en' ? T.fen[c.sector] : T.fth[cTh.sector]) || [];
    var html = '<div class="company-card"><span class="cname">' + c.name + '</span><span class="badge accent csector">' + c.sector + '</span><div class="cbiz">' + c.business + '</div>';
    if (factors.length) html += '<ul class="creminders">' + factors.map(function (f) { return '<li>' + f + '</li>'; }).join('') + '</ul>';
    return html + '</div>';
  }

  /* ══ คุมเงิน/เช็กลิสต์/ควรขาย — ผลมาจาก InvestCalc ══ */
  var CHK_KEY = { trendUp: 'trendUpAdx', trendDn: 'trendNotUpAdx', noChase: 'notChasing', chasing: 'chasing', trendNeedData: 'needChartFirst',
    rsiOk: 'rsiOk', rsiHot: 'rsiHot', rsiNeedData: 'rsiNeedChart', stopSet: 'stopSetOk', stopUnset: 'stopNotSet', riskOk: 'riskOk', riskHigh: 'riskHigh',
    rrOk: 'rrOk', rrLow: 'rrLow', rrNeedData: 'rrNeedInfo' };
  function chkText(c) {
    var v = c.vars || {}, txt = t(CHK_KEY[c.code], { adx: v.adx != null && isFinite(v.adx) ? Number(v.adx).toFixed(0) : '', pct: v.v, rsi: v.v, rr: v.v });
    if ((c.code === 'trendUp' || c.code === 'trendDn') && isFinite(v.adx)) txt += t(v.adxStrong ? 'adxStrongTxt' : 'adxWeakTxt', { adx: Number(v.adx).toFixed(0) });
    return txt;
  }
  function doChecklist() {
    var checks = Calc.checklist[M.chk]({ a: lastAnalysis && lastAnalysis.det ? lastAnalysis : null, entry: num($('entry').value), stop: num($('stop').value), riskPct: num($('riskPct').value) });
    var v = Calc.checklistVerdict(checks), box = $('checkResult'), el = $('checkVerdict');
    if (v.verdict === 'fail') { el.className = 'callout err'; el.textContent = t('checklistFail', { n: v.fails }); }
    else if (v.verdict === 'unknown') { el.className = 'callout warn'; el.textContent = t('checklistUnknown'); }
    else { el.className = 'callout ok'; el.textContent = t('checklistGo'); }
    IC.renderChecklist($('chkList'), checks, chkText);
    box.style.display = 'block';
  }
  function noteText(res) {
    if (res.note === 'minLot') return t('minLotNote', { pct: num($('riskPct').value), riskPct: num($('riskPct').value) });
    if (res.note === 'minShare') return t('minShareNote', { riskPct: num($('riskPct').value), pct: num($('riskPct').value) });
    if (res.note === 'capitalLimit') return t('capitalLimitNote');
    return '';
  }
  function doCalc() {
    var capital = num($('capital').value), riskPct = num($('riskPct').value);
    var entry = num($('entry').value), stop = num($('stop').value), comm = num($('comm').value), commMin = num($('commMin').value);
    if (!isFinite(entry)) entry = num($('price').value);
    if (!isFinite(entry)) { setStatus(tl('enterEntryFirst'), 'err'); return; }
    if (!isFinite(stop)) { stop = (lastAnalysis && isFinite(lastAnalysis.suggestStop)) ? lastAnalysis.suggestStop : entry * 0.95; $('stop').value = stop.toFixed(2); }
    if (!isFinite(capital) || capital <= 0) { capital = M.capital; $('capital').value = capital; }
    if (!isFinite(riskPct) || riskPct <= 0) { riskPct = 2; $('riskPct').value = riskPct; }
    if (!isFinite(comm) || comm < 0) { comm = M.comm; $('comm').value = comm; }
    if (market === 'th' && (!isFinite(commMin) || commMin < 0)) { commMin = M.commMin; $('commMin').value = commMin; }
    var res = Calc.riskCalc[M.risk]({ capital: capital, riskPct: riskPct, entry: entry, stop: stop, comm: comm, commMin: commMin, resistance: lastAnalysis ? lastAnalysis.resistance : NaN });
    var box = $('riskResult');
    if (res.error) {
      $('riskHeadline').innerHTML = '<span class="dn">' + esc(t(res.error)) + '</span>';
      $('riskKv').innerHTML = ''; $('tpRow').innerHTML = ''; box.classList.add('show'); $('saveBtn').style.display = 'none'; return;
    }
    var kv = '';
    if (market === 'th') {
      $('riskHeadline').innerHTML = t('calcHeadline', { shares: fmt0(res.shares), lots: fmt0(res.lots), cost: fmt0(res.cost) });
      kv += '<div class="k">' + t('kvRiskIfWrong') + '</div><div class="v risk">฿' + fmt0(res.riskBaht) + '</div>';
      kv += '<div class="k">' + t('kvStopPrice') + '</div><div class="v">' + fmt(stop) + '</div>';
      kv += '<div class="k">' + t('kvCommRoundtrip') + '</div><div class="v">฿' + fmt0(res.commBaht) + ' (' + fmt(res.commPct, 1) + '%)</div>';
    } else {
      $('riskHeadline').innerHTML = t('calcHeadline', { shares: fmt0(res.shares), cost: usd0(res.cost), fx: fxSpan(res.cost) });
      kv += '<div class="k">' + t('kvRiskIfWrong') + '</div><div class="v risk">' + usd0(res.riskUsd) + fxSpan(res.riskUsd) + '</div>';
      kv += '<div class="k">' + t('kvStopPrice') + '</div><div class="v">' + fmt(stop) + '</div>';
    }
    kv += '<div class="k">' + t('kvBreakeven') + '</div><div class="v">' + fmt(res.breakeven) + '</div>';
    if (isFinite(res.rr)) kv += '<div class="k">' + t('kvRR') + '</div><div class="v">' + fmt(res.rr, 1) + ' : 1</div>';
    $('riskKv').innerHTML = kv;
    $('tpRow').innerHTML = '<span class="badge accent">' + t('tpLot1', { price: fmt(res.tp1) }) + '</span><span class="badge accent">' + t('tpLot2', { price: fmt(res.tp2) }) + '</span><span class="badge accent">' + t('tpLot3', { price: fmt(res.tp3) }) + '</span>';
    if (res.note) $('tpRow').innerHTML += '<div class="callout warn">' + esc(noteText(res)) + '</div>';
    if (res.minKicksIn) $('tpRow').innerHTML += '<div class="callout warn">' + t('commMinNote', { min: fmt0(commMin), pct: fmt(res.commPct, 1), breakeven: fmt(res.breakeven) }) + '</div>';
    box.classList.add('show');
    $('saveBtn').style.display = 'inline-flex';
    $('saveBtn')._data = { sym: curSym() || t('thisStock'), shares: res.shares, cost: entry };
  }

  /* ══ พอร์ต — อ่านสด → แก้ → เขียน (คีย์เดิม) · แก้/ลบด้วย ts ══ */
  function pfKey() { return P + M.pf; }
  function loadPf() { try { var a = JSON.parse(localStorage.getItem(pfKey())); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function writePf(a) { try { localStorage.setItem(pfKey(), JSON.stringify(a)); } catch (e) {} }
  function uniqueTs(list) { var ts = Date.now(); while (list.some(function (r) { return r && r.ts === ts; })) ts++; return ts; }
  function addHolding(sym, shares, cost) {
    var pf = loadPf(); pf.push({ sym: sym, shares: shares, cost: cost, ts: uniqueTs(pf) }); writePf(pf);
  }
  function updateHolding(ts, mut) {
    var pf = loadPf(); pf.forEach(function (h) { if (h && h.ts === ts) mut(h); }); writePf(pf);
  }
  function removeHolding(ts) { writePf(loadPf().filter(function (h) { return !(h && h.ts === ts); })); }
  function plHtml(pl, pct) {
    return (pl >= 0 ? '+' : '−') + money0(Math.abs(pl)).replace(/^−/, '') + ' (' + (pct >= 0 ? '+' : '') + fmt(pct, 1) + '%)' + fxSpan(pl);
  }
  function sellLevelsHtml(levels, a) {
    var LBL = { sar: 'sarLabel', stop: 'stopRiskLabel', ema20: 'ema20Label', resistance: 'resistLabel' };
    var html = '<ul class="sell-levels">';
    levels.forEach(function (lv) {
      var reason;
      switch (lv.reasonCode) {
        case 'sarNoData': reason = t('sarNoData'); break;
        case 'sarUp': reason = t('sarUpReason', { price: fmt(lv.price), sar: fmt(lv.price) }); break;
        case 'sarDown': reason = t('sarDnReason'); break;
        case 'stopReason': reason = t('stopRiskReason', { atr: isFinite(lv.atr) ? t('atrSuffix', { atr: fmt(lv.atr) }) : '' }); break;
        case 'ema20': reason = t('ema20Reason'); break;
        case 'resist': reason = t('resistReason'); break;
        default: reason = t('noData');
      }
      html += '<li><div class="row ' + lv.type + '"><span>' + t(LBL[lv.key]) + '</span><span class="price">' + (isFinite(lv.price) ? fmt(lv.price) : '—') + '</span></div><div class="reason">' + reason + '</div></li>';
    });
    return html + '</ul>';
  }
  var SELL_KEY = { sarDown: 'sellSarDn', belowTrend: 'sellBelowTrend', hotRsi: 'sellHotRsi', nearResist: 'sellNearResist', hold: 'sellHold' };
  function renderPf() {
    var pf = loadPf(), box = $('pfBox');
    if (!pf.length) { box.innerHTML = '<div class="pf-empty">' + t('pfEmptyDefault') + '</div>'; return; }
    var html = '<div class="table-wrap"><table class="table pf-table"><thead><tr><th>' + t('pfThSym') + '</th><th>' + t('pfThShares') + '</th><th>' + t('pfThCost') + '</th><th>' + t('pfThCur') + '</th><th>' + t('pfThPl') + '</th><th></th></tr></thead><tbody>';
    pf.forEach(function (h) {
      html += '<tr data-ts="' + h.ts + '"><td>' + esc(h.sym) + '</td><td>' + fmt0(h.shares) + '</td><td>' + fmt(h.cost) + '</td>' +
        '<td><input type="number" class="input pf-price" inputmode="decimal" step="0.01" placeholder="' + t('pfPricePh') + '" value="' + (h.cur != null ? h.cur : '') + '"></td>' +
        '<td class="pf-pl">—</td><td class="pf-actions"><button class="btn sm pf-sell" title="' + t('pfSellTitle') + '">' + t('pfSellBtn') + '</button><button class="btn sm ghost icon pf-del" title="' + t('pfDelTitle') + '" aria-label="' + t('pfDelTitle') + '"><svg class="ome-icon" aria-hidden="true"><use href="icons.svg#i-x"/></svg></button></td></tr>' +
        '<tr class="pf-sellrow" data-sr="' + h.ts + '"><td colspan="6"></td></tr>';
    });
    box.innerHTML = html + '</tbody></table></div>';
    [].forEach.call(box.querySelectorAll('tr[data-ts]'), function (tr) {
      var ts = Number(tr.getAttribute('data-ts')), h = pf.filter(function (x) { return x.ts === ts; })[0];
      var inp = tr.querySelector('.pf-price'), cell = tr.querySelector('.pf-pl');
      var sellCell = box.querySelector('tr[data-sr="' + ts + '"] td');
      function upd() {
        var cur = num(inp.value);
        if (!isFinite(cur)) { cell.textContent = '—'; cell.className = 'pf-pl'; return; }
        var pl = (cur - h.cost) * h.shares, pct = (cur / h.cost - 1) * 100;
        cell.innerHTML = plHtml(pl, pct); cell.className = 'pf-pl ' + (pl >= 0 ? 'up' : 'down');
      }
      inp.addEventListener('input', function () { upd(); var v = num(inp.value); updateHolding(ts, function (r) { r.cur = v; }); });
      tr.querySelector('.pf-del').addEventListener('click', function () { removeHolding(ts); renderPf(); });
      tr.querySelector('.pf-sell').addEventListener('click', function () {
        sellCell.innerHTML = '<div class="callout warn">' + t('fetchingSellPrice', { sym: esc(h.sym) }) + '</div>';
        getSeries(h.sym).then(function (r) {
          var s = r.series, a = analyze(s), v = Calc.sellVerdict(a), price = s.closes[s.closes.length - 1];
          inp.value = price.toFixed(2); updateHolding(ts, function (x) { x.cur = price; }); h.cur = price; upd();
          var pl = (price - h.cost) * h.shares, pct = (price / h.cost - 1) * 100;
          sellCell.innerHTML = '<div class="sell-detail"><div class="sell-verdict ' + v.cls + '">' + t(SELL_KEY[v.code]) +
            '<br><span class="sub">' + t('sellLatestPrice', { price: fmt(price) }) + (r.stale ? t('sellSavedAge', { age: cacheAgeText(r.cachedAt) }) : '') +
            t('sellCostLabel', { cost: fmt(h.cost) }) + (pl >= 0 ? t('sellProfit') : t('sellLoss')) + money0(Math.abs(pl)) + fxSpan(pl) + ' (' + (pct >= 0 ? '+' : '') + fmt(pct, 1) + '%)</span>' +
            sellLevelsHtml(v.levels, a) + '</div>' + companyInfoHtml(h.sym) + '<div class="news-block"></div></div>';
          renderNewsBlock(sellCell.querySelector('.news-block'), h.sym, false);
        }, function () {
          sellCell.innerHTML = '<div class="sell-detail"><div class="callout warn">' + t('sellFetchFail', { sym: esc(h.sym) }) + '</div>' + companyInfoHtml(h.sym) + '</div>';
        });
      });
      upd();
    });
  }

  /* ══ สลับตลาด (แท็บ #th / #us) ══ */
  function resetForMarket() {
    IC.live.stop(); lastSeries = null; lastAnalysis = null; lastNewsItems = null; newsSym = null; lastLive = null; lastSource = { kind: 'real' };
    destroyChart();
    ['shead'].forEach(function (id) { $(id).style.display = 'none'; });
    $('whyBox').hidden = true; $('aiSumCard').style.display = 'none'; $('stockNewsCard').style.display = 'none';
    $('riskResult').classList.remove('show'); $('saveBtn').style.display = 'none'; $('checkResult').style.display = 'none';
    ['price', 'hi', 'lo', 'entry', 'stop', 'pasteBox'].forEach(function (id) { $(id).value = ''; });
    $('sym').value = ''; $('capital').value = M.capital; $('comm').value = M.comm; $('commMin').value = M.commMin;
    $('commMinField').style.display = market === 'th' ? '' : 'none';
    $('fxBox').hidden = market !== 'us'; $('priceFx').textContent = '';
    $('sym').placeholder = M.defSym; $('pfSym').placeholder = M.defSym;
    $('pasteBox').placeholder = market === 'th' ? '34.50 34.75 35.00 34.80 35.25 35.50 ...' : '180.50 181.20 182.00 181.40 183.10 184.00 ...';
    $('journalLink').setAttribute('href', 'invest-trade-journal.html#' + market);
    $('crumbHere').textContent = t(market === 'th' ? 'tabTh' : 'tabUs');
    setStatus('', ''); applyStaticI18n(); renderPf(); startLive();
  }
  function onMarketTab(key, first) {
    var isStock = key === 'th' || key === 'us';
    curTab = key;
    $('panelAnalysis').hidden = !isStock; $('panelScan').hidden = key !== 'scan'; $('panelPaper').hidden = key !== 'paper';
    if (!isStock) applyStaticI18n(); // เปิดหน้าที่แท็บสแกน/พอร์ตจำลองตรงๆ: ข้อความคงที่ของหน้า (ลิงก์ crumb ฯลฯ) ยังไม่ถูกแปลตามภาษา
    $('crumbHere').textContent = t(key === 'th' ? 'tabTh' : key === 'us' ? 'tabUs' : key === 'scan' ? 'tabScan' : 'tabPaper');
    if (!isStock) {
      IC.live.stop();
      /* invest-scan.js / invest-paper.js โหลดหลังไฟล์นี้ (defer ตามลำดับ) — รอจนทุกสคริปต์พร้อมก่อนเปิดแท็บ */
      var openLater = function () {
        if (curTab === 'scan' && window.InvestScan) window.InvestScan.init(market);
        if (curTab === 'paper' && window.InvestPaper) window.InvestPaper.init();
      };
      if (document.readyState === 'complete') openLater(); else window.addEventListener('load', openLater);
      return;
    }
    market = key; M = MARKETS[key];
    resetForMarket();
    var q = new URLSearchParams(location.search).get('sym');
    if (q && first) { $('sym').value = q.toUpperCase().replace(/\.BK$/, ''); doFetch(); }
  }

  function init() {
    IC.subnav($('ivSubRow'), 'stock');
    $('verdictChip').addEventListener('click', function () { $('whyBox').hidden = !$('whyBox').hidden; });
    $('fetchBtn').addEventListener('click', doFetch);
    $('marketRefresh').addEventListener('click', refreshLive);
    $('marketSettings').addEventListener('click', function () { IC.live.openSettings(function () { startLive(); }); });
    $('analyzeBtn').addEventListener('click', doAnalyze);
    $('demoBtn').addEventListener('click', doDemo);
    $('pasteBtn').addEventListener('click', doPaste);
    $('calcBtn').addEventListener('click', doCalc);
    $('sym').addEventListener('keydown', function (e) { if (e.key === 'Enter') doFetch(); });
    $('sym').addEventListener('input', function () { IC.live.stop(); clearTimeout(init._d); init._d = setTimeout(startLive, 700); });
    ['price', 'hi', 'lo'].forEach(function (id) { $(id).addEventListener('input', function () { lastSeries = null; updatePriceFx(); }); });
    $('tfGroup').addEventListener('click', function (e) { var b = e.target.closest('.tf'); if (b) applyTF(+b.getAttribute('data-tf')); });
    $('tgGroup').addEventListener('click', function (e) { var b = e.target.closest('.tg'); if (!b) return; var k = b.getAttribute('data-tg'); tg[k] = !tg[k]; applyToggles(); });
    $('saveBtn').addEventListener('click', function () {
      var d = $('saveBtn')._data; if (!d) return;
      addHolding(d.sym, d.shares, d.cost); renderPf();
      $('saveBtn').textContent = t('savedBtn');
      setTimeout(function () { $('saveBtn').innerHTML = t('saveToPortfolioBtn'); }, 1500);
    });
    $('checkBtn').addEventListener('click', doChecklist);
    $('pfAdd').addEventListener('click', function () {
      var sym = ($('pfSym').value || '').trim().toUpperCase(), shares = num($('pfShares').value), cost = num($('pfCost').value);
      if (!sym) { window.tanotAlert(t('alertEnterSym')); return; }
      if (!isFinite(shares) || shares <= 0 || !isFinite(cost) || cost <= 0) { window.tanotAlert(t('alertEnterValid')); return; }
      addHolding(sym, shares, cost); $('pfSym').value = ''; $('pfShares').value = ''; $('pfCost').value = ''; renderPf();
    });
    $('aiSumBtn').addEventListener('click', doAiSummary);
    $('fxFetchBtn').addEventListener('click', doFxFetch);
    $('fxShowChk').addEventListener('change', function () { updatePriceFx(); if ($('riskResult').classList.contains('show')) doCalc(); renderPf(); });
    $('fxRate').addEventListener('input', function () { fxRate = num($('fxRate').value); updatePriceFx(); if ($('riskResult').classList.contains('show')) doCalc(); renderPf(); });
    var fxc = IC.lsJson(Calc.FX_KEY); if (fxc && isFinite(fxc.rate)) { fxRate = fxc.rate; $('fxRate').value = fxc.rate.toFixed(2); }

    window.addEventListener('beforeunload', IC.live.stop);
    IC.tabs({ el: $('stockTabs'), page: 'stock', def: 'th', t: t,
      tabs: [{ key: 'th', labelKey: 'tabTh' }, { key: 'us', labelKey: 'tabUs' }, { key: 'scan', labelKey: 'tabScan' }, { key: 'paper', labelKey: 'tabPaper' }],
      onShow: onMarketTab });
    IC.onLang(function () {
      applyStaticI18n(); IC.subnav($('ivSubRow'), 'stock');
      if (statusKeep) setStatus(statusKeep, statusCls);
      if (liveUIArgs) setLiveUI(liveUIArgs[0], liveUIArgs[1], liveUIArgs[2]);
      if (newsSym && $('stockNewsCard').style.display === 'block') showStockNews(newsSym);
      $('crumbHere').textContent = t(curTab === 'th' ? 'tabTh' : curTab === 'us' ? 'tabUs' : curTab === 'scan' ? 'tabScan' : 'tabPaper');
      if ($('shead').style.display === 'flex' && $('stkSym').textContent) updateStockHead(lastSource && lastSource.kind === 'demo' ? t('sampleWord') : $('stkSym').textContent);
      if (lastSeries) useSeries(lastSeries);
      renderPf();
    });
    if (window.TanotData && window.TanotData.onChange) window.TanotData.onChange(function () { renderPf(); });
  }
  init();
})();
