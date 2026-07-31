/* ══════════════════════════════════════════════════════════════════
   Tanot — ลงทุนทำธุรกิจ (รายได้เสริม/ธุรกิจส่วนตัว)
   • เครื่องคำนวณจุดคุ้มทุน (breakeven) + ระยะเวลาคืนทุน
   • เช็กลิสต์ "พร้อมเริ่มหรือยัง?" (เงินสำรอง/สัญญาจ้าง/เวลา/ทุน/ใบอนุญาต)
   • บันทึกไอเดียที่กำลังพิจารณาไว้เทียบกัน เก็บใน localStorage
   หมายเหตุ: ตัวช่วยคิด ไม่ใช่คำแนะนำการลงทุนหรือกฎหมาย
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var LOG_KEY = 'tanot:invest:bizplan';
  var MARGIN_OK = 1.2; /* เผื่อกันชนอย่างน้อย ~20% เหนือจุดคุ้มทุนถึงจะถือว่า "เขียว" */

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }
  function fmt0(n) { return isFinite(n) ? Math.round(n).toLocaleString('th-TH') : '—'; }
  function fmt(n, d) { d = d == null ? 2 : d; return isFinite(n) ? n.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'; }
  function baht(n) { return '฿' + fmt0(n); }

  /* ── ไอเดียอ้างอิง: รายละเอียดเครื่องมือครบวงจร (list ↔ detail แยกหน้าจอในการ์ดเดียวกัน) ── */
  var PHASE_NAMES = ['เตรียมตัว/วางแผน', 'หาลูกค้า/การตลาด', 'ทำงาน/ผลิต', 'ส่งงาน/ส่งมอบ', 'เก็บเงิน/บัญชี'];

  var IDEAS = [
    {
      id: 'freelance', icon: '🧑‍💻', title: 'ขายทักษะ/ที่ปรึกษาฟรีแลนซ์',
      tagline: 'ใช้ทักษะที่มีอยู่แล้วรับงานนอกเวลา',
      phases: [
        { tools: [
          { name: 'พอร์ตโฟลิโอออนไลน์', why: 'โชว์ผลงาน/ประวัติให้ลูกค้าเชื่อถือก่อนจ้าง', get: 'Notion หรือ Google Sites (ฟรี ทำเว็บพอร์ตง่ายๆ ได้เลย)' },
          { name: 'เทมเพลตสัญญาว่าจ้าง/ขอบเขตงาน (SOW)', why: 'กันปัญหาขอบเขตงานไม่ชัดหรือลูกค้าเบี้ยวภายหลัง', get: 'ค้นหา "freelance contract template" บน GitHub — มีเทมเพลตโอเพนซอร์สหลาย repo ให้โหลดปรับใช้ฟรี' }
        ]},
        { tools: [
          { name: 'แพลตฟอร์มฟรีแลนซ์ไทย', why: 'ช่องทางหางานที่มีคนหาช่างอยู่แล้ว', get: 'Fastwork, Freelancer.co.th, กลุ่ม Facebook งานฟรีแลนซ์' },
          { name: 'LinkedIn', why: 'สร้างเครดิตมืออาชีพ หาลูกค้าองค์กร', get: 'linkedin.com (ฟรี)' }
        ]},
        { tools: [
          { name: 'Google Workspace', why: 'เอกสาร/ชีต/สไลด์ทำงานร่วมกับลูกค้าได้', get: 'ฟรีสำหรับใช้งานพื้นฐาน' },
          { name: 'Zoom / Google Meet', why: 'ประชุมลูกค้าทางไกล', get: 'ฟรี (จำกัดเวลาบางแพ็กเกจ)' },
          { name: 'Trello / Notion', why: 'จัดการงาน/deadline ไม่ให้หลุด', get: 'ฟรีสำหรับผู้ใช้คนเดียว' }
        ]},
        { tools: [
          { name: 'Google Drive / Dropbox', why: 'ส่งไฟล์งานให้ลูกค้าเป็นระเบียบ', get: 'ฟรี (พื้นที่จำกัด)' },
          { name: 'WeTransfer', why: 'ส่งไฟล์ขนาดใหญ่โดยไม่ต้องมีบัญชี', get: 'wetransfer.com (ฟรีไม่เกิน 2GB/ครั้ง)' }
        ]},
        { tools: [
          { name: 'พร้อมเพย์ / โอนตรง', why: 'รับเงินจากลูกค้าไทยง่ายสุด', get: 'แอปธนาคารที่มีอยู่แล้ว' },
          { name: 'ระบบออกใบแจ้งหนี้', why: 'ดูมืออาชีพ + เก็บประวัติรายรับ', get: 'Invoice Ninja (โอเพนซอร์สบน GitHub ติดตั้งเองหรือใช้เว็บฟรีได้) หรือเว็บ invoice generator ฟรีทั่วไป' }
        ]}
      ]
    },
    {
      id: 'course', icon: '🎓', title: 'สอน/ทำคอร์สออนไลน์',
      tagline: 'ถ่ายทอดความรู้เป็นคอร์สหรือติวเตอร์',
      phases: [
        { tools: [
          { name: 'โครงร่างเนื้อหา (Curriculum outline)', why: 'วางลำดับหัวข้อสอนให้ผู้เรียนตามทันไม่กระโดดข้าม', get: 'Google Docs/Sheets (ฟรี) ร่างเป็นหัวข้อ-ซับหัวข้อ' },
          { name: 'ไมโครโฟน + กล้อง/มือถือ', why: 'เสียงชัดคือปัจจัยที่คนดูให้อภัยภาพไม่สวยได้มากกว่าเสียงไม่ชัด', get: 'ไมค์ USB ราคาประหยัด (เช่น Fifine/Boya) หรือใช้มือถือรุ่นที่มีอยู่แล้ว' }
        ]},
        { tools: [
          { name: 'โพสต์ตัวอย่างสอนสั้นๆ', why: 'ให้คนเห็นสไตล์การสอนก่อนตัดสินใจซื้อ', get: 'TikTok / Facebook Reels / YouTube Shorts (ฟรี)' },
          { name: 'LINE OA / กลุ่ม Facebook', why: 'รวมคนสนใจไว้ที่เดียว ตอบคำถามและปิดการขาย', get: 'LINE Official Account (ฟรีเริ่มต้น), Facebook Group' }
        ]},
        { tools: [
          { name: 'OBS Studio', why: 'อัดหน้าจอ/สอนสด คุณภาพเทียบเท่ามืออาชีพ', get: 'โอเพนซอร์สฟรี ดาวน์โหลดจาก obsproject.com (โค้ดอยู่บน GitHub: obsproject/obs-studio)' },
          { name: 'CapCut หรือ DaVinci Resolve', why: 'ตัดต่อวิดีโอ ตัดส่วนเกิน ใส่คำบรรยาย', get: 'แอปมือถือ/เดสก์ท็อป มีแผนฟรี' },
          { name: 'Canva', why: 'ทำสไลด์ประกอบการสอนให้ดูเป็นมืออาชีพ', get: 'canva.com มีแผนฟรี' }
        ]},
        { tools: [
          { name: 'แพลตฟอร์มโฮสต์คอร์ส', why: 'อัปโหลดวิดีโอ จัดการผู้เรียน ออกใบรับรอง', get: 'YouTube (ฟรี, unlisted), Skooldio/Udemy (แบ่งรายได้), Google Classroom (ฟรีสำหรับติวเตอร์)' },
          { name: 'Google Forms', why: 'แบบทดสอบ/แบบประเมินหลังเรียน', get: 'ฟรี' }
        ]},
        { tools: [
          { name: 'ระบบชำระเงินของแพลตฟอร์ม', why: 'แพลตฟอร์มคอร์สจัดการเก็บเงินให้อยู่แล้ว ปลอดภัยกว่าโอนตรงกับคนแปลกหน้า', get: 'ในตัวแพลตฟอร์ม (Skooldio/Udemy) หรือ Omise ถ้าขายเอง' },
          { name: 'พร้อมเพย์', why: 'รับเงินค่าติวตัวต่อตัวโดยตรง', get: 'แอปธนาคารที่มีอยู่แล้ว' }
        ]}
      ]
    },
    {
      id: 'online-sales', icon: '🛍️', title: 'ขายสินค้าออนไลน์',
      tagline: 'ผลิตเองหรือหาสินค้ามาขายผ่านมาร์เก็ตเพลส/โซเชียล',
      phases: [
        { tools: [
          { name: 'หาสินค้า/ต้นทาง', why: 'ตัดสินใจผลิตเองหรือหาซัพพลายเออร์ส่งต่อ (dropship)', get: 'ตลาดค้าส่งเช่นสำเพ็ง/โบ๊เบ๊ หรือแพลตฟอร์มซัพพลายเออร์อย่าง 1688 (ผ่านเอเย่นต์นำเข้า)' },
          { name: 'ไฟถ่ายภาพสินค้า + ฉากหลัง', why: 'ภาพสินค้าที่ดูดีเพิ่มยอดขายได้จริง', get: 'ชุดไฟ softbox ราคาประหยัดจาก Shopee/Lazada' }
        ]},
        { tools: [
          { name: 'Canva', why: 'ทำโพสต์/แบนเนอร์โปรโมตสินค้า', get: 'ฟรี' },
          { name: 'Facebook Marketplace/กลุ่มซื้อขาย, TikTok Shop', why: 'ช่องทางที่มีคนซื้อของอยู่แล้วจำนวนมาก', get: 'ฟรีเปิดร้าน' }
        ]},
        { tools: [
          { name: 'Shopee/Lazada Seller Center', why: 'ลงขาย จัดการออเดอร์ โปรโมชั่นในที่เดียว', get: 'ฟรีสมัครเป็นผู้ขาย' },
          { name: 'Google Sheets หรือ Loyverse POS', why: 'จัดการสต๊อกไม่ให้ขายเกินของที่มี', get: 'Google Sheets ฟรี / Loyverse POS ฟรีสำหรับร้านเล็ก' }
        ]},
        { tools: [
          { name: 'บริการขนส่ง', why: 'ส่งสินค้าถึงลูกค้า', get: 'Kerry Express, Flash Express, ไปรษณีย์ไทย (เทียบราคา/ความเร็ว)' },
          { name: 'เครื่องพิมพ์ใบปะหน้า/สติกเกอร์', why: 'ลดเวลาเขียนที่อยู่มือ ลดความผิดพลาด', get: 'เครื่องพิมพ์ความร้อนราคาประหยัดที่เชื่อมแอปขนส่งได้' }
        ]},
        { tools: [
          { name: 'เก็บเงินปลายทาง (COD) ผ่านแพลตฟอร์ม', why: 'แพลตฟอร์มโอนเงินให้หลังลูกค้ารับของ ลดความเสี่ยงโกง', get: 'ในตัว Shopee/Lazada' },
          { name: 'พร้อมเพย์/คิวอาร์โค้ด', why: 'รับเงินโอนตรงจากลูกค้าขายผ่านโซเชียล', get: 'แอปธนาคารที่มีอยู่แล้ว' }
        ]}
      ]
    },
    {
      id: 'tools-apps', icon: '🧰', title: 'ทำเครื่องมือ/แอปขายหรือให้เช่า',
      tagline: 'สร้างของที่ใช้ซ้ำได้ ขายทีเดียวหรือเก็บค่าสมาชิก',
      phases: [
        { tools: [
          { name: 'วางสเปคเครื่องมือ/ฟีเจอร์หลัก (MVP)', why: 'กันทำเกินจำเป็นก่อนรู้ว่ามีคนอยากใช้จริง', get: 'Notion/Google Docs ร่าง feature list ฟรี' },
          { name: 'VS Code', why: 'เครื่องมือเขียนโค้ดหลัก ฟรีและรองรับเกือบทุกภาษา', get: 'โอเพนซอร์สฟรี ดาวน์โหลดจาก code.visualstudio.com' }
        ]},
        { tools: [
          { name: 'โพสต์ตัวอย่างการใช้งานสั้นๆ', why: 'โชว์ปัญหาที่เครื่องมือแก้ให้เห็นชัดในไม่กี่วินาที', get: 'TikTok / Facebook / X (ฟรี)' },
          { name: 'Landing page อธิบายสินค้า', why: 'หน้าเดียวที่บอกว่าทำอะไร ราคาเท่าไร กดซื้อตรงไหน', get: 'GitHub Pages (ฟรี, โฮสต์แบบเดียวกับเว็บนี้เอง) หรือ Carrd (ฟรีเริ่มต้น)' }
        ]},
        { tools: [
          { name: 'GitHub', why: 'เก็บโค้ด ย้อนดูประวัติแก้ไข และค้นหาไลบรารีโอเพนซอร์สมาใช้แทนสร้างเองตั้งแต่ต้น', get: 'github.com ฟรีสำหรับ repo จำนวนจำกัด' },
          { name: 'เครื่องมือ no-code (Bubble/Glide)', why: 'ทำแอปได้โดยไม่ต้องเขียนโค้ดถ้าไม่ถนัดสายเทค', get: 'มีแผนฟรีเริ่มต้นให้ทดลอง' }
        ]},
        { tools: [
          { name: 'GitHub Pages / Vercel / Netlify', why: 'โฮสต์เว็บ/แอปให้ลูกค้าใช้งานได้จริงโดยไม่มีค่าใช้จ่ายเซิร์ฟเวอร์', get: 'ฟรีสำหรับโปรเจกต์ขนาดเล็ก-กลาง' },
          { name: 'เอกสารวิธีใช้งาน', why: 'ลดคำถามซ้ำๆ จากผู้ใช้หลังส่งมอบ', get: 'Notion หรือ Google Docs ฟรี' }
        ]},
        { tools: [
          { name: 'Gumroad หรือ itch.io', why: 'ขายซอฟต์แวร์/ไฟล์ดิจิทัลพร้อมระบบเก็บเงินและออกลิงก์ดาวน์โหลดให้อัตโนมัติ', get: 'สมัครฟรี หักค่าธรรมเนียมต่อยอดขาย' },
          { name: 'ระบบสมาชิกรายเดือน (ถ้าเก็บค่าเช่าใช้)', why: 'เก็บเงินอัตโนมัติแบบสมัครสมาชิกแทนขายทีเดียว', get: 'Stripe/Omise (ต้องมีเอกสารตามเงื่อนไขผู้ให้บริการ)' }
        ]}
      ]
    },
    {
      id: 'rental', icon: '🏠', title: 'ให้เช่าทรัพย์สินที่มี',
      tagline: 'ห้อง/รถ/อุปกรณ์ที่ไม่ได้ใช้เต็มเวลา',
      phases: [
        { tools: [
          { name: 'ทำความสะอาด+เตรียมของให้พร้อมใช้', why: 'ของที่ดูแลดีได้ราคาเช่าดีกว่าและรีวิวดีกว่า', get: 'อุปกรณ์ทำความสะอาดที่มีอยู่แล้ว' },
          { name: 'เทมเพลตสัญญาเช่า', why: 'ระบุเงื่อนไข/มัดจำ/ความรับผิดชัดเจน กันข้อพิพาทภายหลัง', get: 'ค้นหาแบบฟอร์มสัญญาเช่ามาตรฐานจากหน่วยงานราชการ/เว็บกฎหมายทั่วไป ปรับใช้ได้ฟรี' }
        ]},
        { tools: [
          { name: 'มือถือ + ไฟส่องสว่าง', why: 'ภาพถ่ายที่ดูสว่างสะอาดตาเพิ่มโอกาสมีคนสนใจเช่า', get: 'ใช้มือถือที่มีอยู่ ถ่ายตอนกลางวัน/เปิดไฟให้ครบ' },
          { name: 'แพลตฟอร์มลงประกาศ', why: 'ช่องทางที่มีคนหาเช่าอยู่แล้ว', get: 'Airbnb (ห้อง/ที่พัก), Facebook Marketplace/กลุ่มเช่าเฉพาะทาง (รถ/อุปกรณ์)' }
        ]},
        { tools: [
          { name: 'Google Calendar', why: 'กันชนวันจองซ้อนกันระหว่างหลายช่องทาง', get: 'ฟรี' },
          { name: 'แอปส่งข้อความอัตโนมัติ', why: 'ตอบคำถามลูกค้าเรื่องเช็คอิน/เงื่อนไขเร็วขึ้น', get: 'ระบบข้อความอัตโนมัติในตัว Airbnb หรือ LINE OA (ฟรี)' }
        ]},
        { tools: [
          { name: 'เช็กลิสต์ส่งมอบ/รับคืน', why: 'บันทึกสภาพก่อน-หลังเช่า กันข้อพิพาทเรื่องความเสียหาย', get: 'ถ่ายรูป+บันทึกใน Google Sheets/Docs ฟรี' },
          { name: 'กล่องเก็บกุญแจแบบรหัส (key lockbox)', why: 'ส่งมอบกุญแจสะดวกโดยไม่ต้องเจอหน้ากันทุกครั้ง', get: 'หาซื้อได้ทั่วไปตามร้านฮาร์ดแวร์/ออนไลน์' }
        ]},
        { tools: [
          { name: 'ระบบชำระเงินของแพลตฟอร์ม', why: 'แพลตฟอร์มอย่าง Airbnb โอนเงินให้อัตโนมัติหลังเช็คอินผ่านไปสักระยะ ปลอดภัยกว่าเก็บเงินสดเอง', get: 'ในตัว Airbnb' },
          { name: 'มัดจำ + โอนตรง', why: 'กรณีเช่านอกแพลตฟอร์ม (เช่น รถ/อุปกรณ์ให้เช่าเอง)', get: 'พร้อมเพย์ + สัญญาระบุเงื่อนไขมัดจำคืน' }
        ]}
      ]
    }
  ];

  function findIdea(id) {
    for (var i = 0; i < IDEAS.length; i++) { if (IDEAS[i].id === id) return IDEAS[i]; }
    return null;
  }

  function toolListHtml(tools) {
    var html = '<ul class="tool-list">';
    tools.forEach(function (t) {
      html += '<li><b>' + t.name + '</b><div class="mini">' + t.why + '</div><div class="tool-get">📍 หาได้จาก: ' + t.get + '</div></li>';
    });
    html += '</ul>';
    return html;
  }

  function ideaDetailHtml(idea) {
    var html = '<button class="btn sm" id="bzIdeaBack" type="button">← กลับไปดูไอเดียทั้งหมด</button>';
    html += '<div class="idea-detail-head"><span class="ic">' + idea.icon + '</span><div><b>' + idea.title + '</b><div class="mini">' + idea.tagline + '</div></div></div>';
    idea.phases.forEach(function (ph, i) {
      html += '<div class="phase-h">' + (i + 1) + '. ' + PHASE_NAMES[i] + '</div>' + toolListHtml(ph.tools);
    });
    return html;
  }

  function showIdeaDetail(id) {
    var idea = findIdea(id);
    if (!idea) return;
    $('bzIdeaDetail').innerHTML = ideaDetailHtml(idea);
    $('bzIdeaListWrap').style.display = 'none';
    $('bzIdeaDetail').style.display = 'block';
    try { history.replaceState(null, '', '#idea-' + id); } catch (e) {}
  }

  function hideIdeaDetail() {
    $('bzIdeaDetail').style.display = 'none';
    $('bzIdeaListWrap').style.display = 'block';
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  }

  /* ── เครื่องคำนวณจุดคุ้มทุน (pure — reuse ได้ทั้งการ์ดคำนวณและตอนบันทึกไอเดีย) ── */
  function computeBreakeven(o) {
    var startup = isFinite(o.startup) ? o.startup : 0;
    var fixed = Math.max(0, isFinite(o.fixed) ? o.fixed : 0);
    var price = o.price, varCost = isFinite(o.varCost) ? o.varCost : 0, vol = o.vol;
    var r = { profitPerUnit: NaN, breakevenUnits: NaN, monthlyProfitAtVol: NaN, paybackMonths: NaN, ratio: NaN, cls: 'warn', txt: '' };

    if (!isFinite(price) || price <= 0) { r.txt = 'กรอกราคาขายเฉลี่ยต่อหน่วยให้ถูกต้องก่อน'; return r; }

    r.profitPerUnit = price - varCost;
    if (r.profitPerUnit <= 0) {
      r.cls = 'no';
      r.txt = 'ราคาขาย (' + fmt(price) + ') ต้องสูงกว่าต้นทุนผันแปรต่อหน่วย (' + fmt(varCost) + ') ไม่งั้นยิ่งขายยิ่งขาดทุน — ไม่มีจุดคุ้มทุน';
      return r;
    }
    r.breakevenUnits = fixed / r.profitPerUnit;

    if (!isFinite(vol)) {
      r.cls = 'warn';
      r.txt = 'กรอกปริมาณขายที่คาดหวังต่อเดือน เพื่อประเมินว่าคุ้มไหม (จุดคุ้มทุน ≈ ' + (r.breakevenUnits <= 0 ? 'ตั้งแต่หน่วยแรก' : fmt(r.breakevenUnits, 1) + ' หน่วย/เดือน') + ')';
      return r;
    }

    r.monthlyProfitAtVol = vol * r.profitPerUnit - fixed;
    if (r.monthlyProfitAtVol > 0) { r.paybackMonths = startup <= 0 ? 0 : startup / r.monthlyProfitAtVol; }

    if (r.breakevenUnits <= 0) {
      /* ต้นทุนคงที่ 0 (หรือคุ้มทุนตั้งแต่หน่วยแรก) */
      if (vol > 0) { r.cls = 'go'; r.ratio = Infinity; r.txt = 'ต้นทุนคงที่ต่ำมาก/เป็นศูนย์ คุ้มทุนตั้งแต่หน่วยแรก และคาดขายได้ ' + fmt0(vol) + ' หน่วย/เดือน — มีกำไรที่ปริมาณนี้'; }
      else { r.cls = 'no'; r.txt = 'ปริมาณขายที่คาดเป็น 0 — ยังไม่มีกำไร'; }
      return r;
    }

    r.ratio = vol / r.breakevenUnits;
    if (r.ratio < 1) {
      r.cls = 'no';
      r.txt = 'ปริมาณขายที่คาด (' + fmt0(vol) + ' หน่วย) ยังไม่ถึงจุดคุ้มทุน (' + fmt(r.breakevenUnits, 1) + ' หน่วย) — ขาดทุน ~' + baht(Math.abs(r.monthlyProfitAtVol)) + '/เดือนที่ปริมาณนี้';
    } else if (r.ratio < MARGIN_OK) {
      r.cls = 'warn';
      r.txt = 'คุ้มทุนพอดีๆ (เกินจุดคุ้มทุน ' + fmt((r.ratio - 1) * 100, 0) + '%) กำไรเล็กน้อย เผื่อความผันผวนของยอดขายไม่ค่อยได้';
    } else {
      r.cls = 'go';
      r.txt = 'ปริมาณขายที่คาดเกินจุดคุ้มทุนพอสมควร (+' + fmt((r.ratio - 1) * 100, 0) + '%) มีกันชนไว้บ้าง';
    }
    return r;
  }

  function doCalc() {
    var price = num($('bzPrice').value);
    if (!isFinite(price) || price <= 0) { alert('กรอกราคาขายเฉลี่ยต่อหน่วยให้ถูกต้อง'); return; }
    var o = {
      startup: num($('bzStartup').value) || 0,
      fixed: num($('bzFixed').value) || 0,
      price: price,
      varCost: num($('bzVar').value) || 0,
      vol: num($('bzVol').value)
    };
    var r = computeBreakeven(o);
    $('bzOut').style.display = 'block';

    $('bzProfitUnit').textContent = isFinite(r.profitPerUnit) ? baht(r.profitPerUnit) : '—';
    $('bzBreakeven').textContent = !isFinite(r.breakevenUnits) ? '—' : (r.breakevenUnits <= 0 ? 'ตั้งแต่หน่วยแรก' : fmt(r.breakevenUnits, 1));

    var projEl = $('bzProjected');
    if (isFinite(r.monthlyProfitAtVol)) {
      projEl.textContent = (r.monthlyProfitAtVol >= 0 ? '+' : '−') + baht(Math.abs(r.monthlyProfitAtVol));
      projEl.style.color = r.monthlyProfitAtVol >= 0 ? 'var(--ok)' : 'var(--err)';
    } else { projEl.textContent = '—'; projEl.style.color = ''; }

    $('bzPayback').textContent = isFinite(r.paybackMonths) ? (r.paybackMonths <= 0 ? 'ทันที' : fmt(r.paybackMonths, 1) + ' เดือน') : '—';

    var v = $('bzVerdict');
    v.className = 'verdict-box ' + r.cls;
    v.innerHTML = (r.cls === 'go' ? '🟢 ' : r.cls === 'no' ? '🔴 ' : '🟡 ') + r.txt;
  }

  /* ── เช็กลิสต์ "พร้อมเริ่มหรือยัง?" ── */
  var bzAnswers = { emergency: null, contract: null, time: null, license: null };

  function checklistChecks() {
    var checks = [];
    function ynCheck(key, txt) {
      var v = bzAnswers[key];
      checks.push({ ok: v === 'yes' ? true : v === 'no' ? false : null, txt: txt });
    }
    ynCheck('emergency', 'มีเงินสำรองฉุกเฉินอย่างน้อย 3–6 เดือนของค่าใช้จ่าย (ไม่นับเงินลงทุน)');
    ynCheck('contract', 'เช็คสัญญาจ้างงานปัจจุบันเรื่อง non-compete/ผลประโยชน์ทับซ้อนแล้ว');
    ynCheck('time', 'มีเวลาจริงเพียงพอต่อสัปดาห์ นอกเหนือจากงานประจำ');

    var startup = num($('bzStartup').value), own = num($('bzOwnCapital').value);
    if (!isFinite(startup) || !isFinite(own)) {
      checks.push({ ok: null, txt: 'ทุนเริ่มต้นครอบคลุมไหม — กรอกเงินลงทุนเริ่มต้น (การ์ดด้านบน) และทุนที่มีอยู่จริงก่อน' });
    } else {
      var okCap = own >= startup;
      checks.push({ ok: okCap, txt: okCap ? ('ทุนที่มีอยู่จริง (' + baht(own) + ') ครอบคลุมเงินลงทุนเริ่มต้น (' + baht(startup) + ')') : ('ทุนที่มีอยู่จริง (' + baht(own) + ') ยังไม่พอเงินลงทุนเริ่มต้น (' + baht(startup) + ')') });
    }

    ynCheck('license', 'ธุรกิจนี้ไม่ต้องมีใบอนุญาต/คุณสมบัติเฉพาะ หรือมีครบแล้ว');
    return checks;
  }

  function doChecklist() {
    var checks = checklistChecks();
    var fails = checks.filter(function (c) { return c.ok === false; }).length;
    var unknowns = checks.filter(function (c) { return c.ok === null; }).length;
    var box = $('bzChkResult'), v = $('bzChkVerdict');
    if (fails > 0) { v.className = 'verdict-box no'; v.textContent = '⛔ ยังไม่พร้อม — ติด ' + fails + ' ข้อ ควรแก้ให้ครบก่อนเริ่ม'; }
    else if (unknowns > 0) { v.className = 'verdict-box warn'; v.textContent = '⚠️ ตอบให้ครบก่อนประเมิน — เหลือ ' + unknowns + ' ข้อ'; }
    else { v.className = 'verdict-box go'; v.textContent = '✅ พร้อมเริ่มได้ตามเกณฑ์ — ผ่านครบทุกข้อ (แต่ยังไม่การันตีความสำเร็จ)'; }
    var html = '';
    checks.forEach(function (c) {
      var ic = c.ok === true ? '✅' : c.ok === false ? '❌' : '◻️';
      html += '<li class="' + (c.ok === false ? 'fail' : 'pass') + '"><span class="ic">' + ic + '</span><span>' + c.txt + '</span></li>';
    });
    $('bzChkList').innerHTML = html;
    box.style.display = 'block';
  }

  /* ── บันทึกไอเดียที่กำลังพิจารณา (localStorage) ── */
  function loadLog() { try { return JSON.parse(localStorage.getItem(LOG_KEY)) || []; } catch (e) { return []; } }
  function saveLog(a) { try { localStorage.setItem(LOG_KEY, JSON.stringify(a)); } catch (e) {} }

  function renderLog() {
    var log = loadLog(), box = $('bzLogBox');
    if (!log.length) { box.innerHTML = '<div class="log-empty">ยังไม่มีไอเดียที่บันทึก — กรอกเครื่องคำนวณด้านบนแล้วกด "บันทึกไอเดียนี้"</div>'; return; }
    var html = '<table class="log-table"><thead><tr><th>ไอเดีย</th><th>ลงทุนเริ่มต้น</th><th>คุ้มทุน(หน่วย/ด)</th><th>คืนทุน(ด)</th><th>กำไรคาด/ด</th><th></th></tr></thead><tbody>';
    log.forEach(function (r, i) {
      html += '<tr><td>' + r.name + '</td><td>' + baht(r.startup) + '</td>' +
        '<td>' + (isFinite(r.breakevenUnits) ? fmt(r.breakevenUnits, 1) : '—') + '</td>' +
        '<td>' + (isFinite(r.paybackMonths) ? fmt(r.paybackMonths, 1) : '—') + '</td>' +
        '<td style="color:' + (r.monthlyProfitAtVol >= 0 ? 'var(--ok)' : 'var(--err)') + '">' + (isFinite(r.monthlyProfitAtVol) ? ((r.monthlyProfitAtVol >= 0 ? '+' : '−') + baht(Math.abs(r.monthlyProfitAtVol))) : '—') + '</td>' +
        '<td><button class="log-del" data-i="' + i + '">✕</button></td></tr>';
    });
    html += '</tbody></table>';
    box.innerHTML = html;
    [].forEach.call(box.querySelectorAll('.log-del'), function (b) {
      b.addEventListener('click', function () { var log = loadLog(); log.splice(+b.getAttribute('data-i'), 1); saveLog(log); renderLog(); });
    });
  }

  function addIdea() {
    var name = ($('bzIdeaName').value || '').trim();
    var price = num($('bzPrice').value);
    if (!name) { alert('ใส่ชื่อไอเดียก่อน'); return; }
    if (!isFinite(price) || price <= 0) { alert('กรอกราคาขายเฉลี่ยต่อหน่วยในเครื่องคำนวณด้านบนก่อน'); return; }
    var o = { startup: num($('bzStartup').value) || 0, fixed: num($('bzFixed').value) || 0, price: price, varCost: num($('bzVar').value) || 0, vol: num($('bzVol').value) };
    var r = computeBreakeven(o);
    var log = loadLog();
    log.push({
      name: name, startup: o.startup, fixed: o.fixed, price: o.price, varCost: o.varCost, vol: o.vol,
      profitPerUnit: r.profitPerUnit, breakevenUnits: r.breakevenUnits, paybackMonths: r.paybackMonths, monthlyProfitAtVol: r.monthlyProfitAtVol,
      ts: Date.now()
    });
    saveLog(log);
    $('bzIdeaName').value = '';
    renderLog();
  }

  function init() {
    $('bzIdeaListWrap').addEventListener('click', function (e) {
      var card = e.target.closest('.idea-card'); if (!card) return;
      showIdeaDetail(card.getAttribute('data-id'));
    });
    $('bzIdeaDetail').addEventListener('click', function (e) {
      if (e.target.closest('#bzIdeaBack')) hideIdeaDetail();
    });
    var hashId = (location.hash || '').replace(/^#idea-/, '');
    if (hashId && findIdea(hashId)) showIdeaDetail(hashId);

    $('bzCalcBtn').addEventListener('click', doCalc);
    $('bzChkForm').addEventListener('click', function (e) {
      var btn = e.target.closest('.yn-btn'); if (!btn) return;
      var row = btn.closest('.yn-row'), key = row.getAttribute('data-key'), val = btn.getAttribute('data-val');
      bzAnswers[key] = val;
      [].forEach.call(row.querySelectorAll('.yn-btn'), function (b) { b.classList.remove('on', 'yes', 'no'); });
      btn.classList.add('on', val);
    });
    $('bzChkBtn').addEventListener('click', doChecklist);
    $('bzOwnCapital').addEventListener('input', function () { if ($('bzChkResult').style.display !== 'none') doChecklist(); });
    $('bzAddBtn').addEventListener('click', addIdea);
    renderLog();
    doCalc(); /* แสดงผลตั้งต้นทันที */
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.__biz = { computeBreakeven: computeBreakeven };
})();
