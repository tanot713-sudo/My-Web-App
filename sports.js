/* ══════════════════════════════════════════════════════════════════
   Tanot — เรียนกีฬา (sports.js)
   กติกา + ความรู้กีฬาหลายชนิด แบบสอนอย่างเดียว ไม่มีข้อสอบ/แบบทดสอบ
   สถาปัตยกรรมก็อป-แล้วปรับจาก music.js (แถบเกม/เมนูแฮมเบอร์เกอร์/sidebar ล็อกลำดับ/i18n TH-EN)
   เรียบง่ายกว่า music.js เพราะไม่มีโน้ตดนตรี/เสียง — ทุก item เป็น 'reading' เท่านั้น
   (เนื้อหาอ่าน + ไดอะแกรม SVG ประกอบเมื่อมี กดปุ่ม "เข้าใจแล้ว ไปต่อ" เพื่อปลดล็อกข้อถัดไป
   ไม่มีการตอบคำถามหรือให้คะแนนถูก/ผิด)
   ══════════════════════════════════════════════════════════════════ */
'use strict';

/* ══════════════════════════════════════════════════════════════════
   i18n
   ══════════════════════════════════════════════════════════════════ */
var UI_LANG_KEY = 'tanot:sportslang';
function getUILang() { try { return localStorage.getItem(UI_LANG_KEY) === 'en' ? 'en' : 'th'; } catch (e) { return 'th'; } }
function setUILang(l) { try { localStorage.setItem(UI_LANG_KEY, l); } catch (e) {} }
function pick(obj) { return obj ? (getUILang() === 'en' ? obj.en : obj.th) : ''; }

var I18N = {
  th: {
    pageTitle: 'เรียนกีฬา', crumbResp: 'งานที่รับผิดชอบ', crumbSports: 'เรียนกีฬา',
    markReadBtn: '✓ เข้าใจแล้ว ไปต่อ',
    lockedMsg: 'บทเรียนนี้ยังล็อกอยู่ — ทำข้อก่อนหน้าให้ผ่านก่อน',
    trackDoneMsg: '🎉 จบบทเรียนนี้แล้ว! เลือกบทเรียนถัดไปจากเมนู ☰ ด้านบนได้เลย',
    toastTrackDone: 'จบบทเรียน "{track}" แล้ว! 🎉',
    toastBadge: 'ได้รับเหรียญตรา: "{badge}"!',
    toastLevelUp: 'เลเวลอัป! เลเวล {level} — {title}'
  },
  en: {
    pageTitle: 'Learn Sports', crumbResp: 'Responsibilities', crumbSports: 'Learn Sports',
    markReadBtn: '✓ Got it, continue',
    lockedMsg: 'This lesson is locked — pass the previous one first.',
    trackDoneMsg: '🎉 Lesson complete! Pick the next lesson from the ☰ menu above.',
    toastTrackDone: 'Lesson "{track}" complete! 🎉',
    toastBadge: 'Badge earned: "{badge}"!',
    toastLevelUp: 'Level up! Level {level} — {title}'
  }
};
function t(key, vars) {
  var l = getUILang();
  var s = (I18N[l] && I18N[l][key] !== undefined) ? I18N[l][key] : (I18N.th[key] !== undefined ? I18N.th[key] : key);
  if (vars) Object.keys(vars).forEach(function (k) { s = s.replace('{' + k + '}', vars[k]); });
  return s;
}

/* ══════════════════════════════════════════════════════════════════
   เนื้อหาบทเรียน — ทุกข้อเป็น 'reading' (อ่านอย่างเดียว ไม่มีข้อสอบ)
   ══════════════════════════════════════════════════════════════════ */
/* diagramHtml (ถ้ามี) เป็น HTML คงที่ (มักเป็น SVG) แปะต่อท้ายย่อหน้า — ไม่ต้องพึ่งภาษา
   เพราะป้ายในไดอะแกรมใช้คำสากลที่ใช้ตรงตัวทั้งไทย/อังกฤษอยู่แล้ว (GK, DF, Instep ฯลฯ) */
function readingItem(headingTh, headingEn, paragraphsTh, paragraphsEn, diagramHtml) {
  return { kind: 'reading', heading: { th: headingTh, en: headingEn }, body: { th: paragraphsTh, en: paragraphsEn }, diagram: diagramHtml };
}

/* ══════════════════════════════════════════════════════════════════
   ไดอะแกรมประกอบบทเรียน — SVG วาดเองล้วน (ไม่ใช้ไฟล์ภาพ) ตามแนวทางเดียวกับ music.js
   ══════════════════════════════════════════════════════════════════ */
function svgArrow(x1, y1, x2, y2, color) {
  var angle = Math.atan2(y2 - y1, x2 - x1);
  var headLen = 10;
  var hx1 = x2 - headLen * Math.cos(angle - Math.PI / 6);
  var hy1 = y2 - headLen * Math.sin(angle - Math.PI / 6);
  var hx2 = x2 - headLen * Math.cos(angle + Math.PI / 6);
  var hy2 = y2 - headLen * Math.sin(angle + Math.PI / 6);
  return '<line class="sp-arrow-line" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + color + '" stroke-width="3"/>' +
    '<polygon class="sp-arrow-head" points="' + x2 + ',' + y2 + ' ' + hx1 + ',' + hy1 + ' ' + hx2 + ',' + hy2 + '" fill="' + color + '"/>';
}
function svgWrap(inner, viewW, viewH, maxW, label) {
  return '<div style="text-align:center;margin:16px 0">' +
    '<svg viewBox="0 0 ' + viewW + ' ' + viewH + '" style="width:100%;max-width:' + maxW + 'px;height:auto;display:block;margin:0 auto" role="img" aria-label="' + label + '">' +
    inner + '</svg></div>';
}
/* แถบป้ายข้อเท็จจริงสั้นๆ — ใช้กับบทเรียนที่เป็นกติกา/ตัวเลขล้วน ไม่มีภาพจริงให้วาด
   (facts: [{title, sub, color}, ...] — title เป็นตัวเลข/คำหลัก, sub เป็นคำอธิบายสั้นๆ) */
function svgFactStrip(facts, label) {
  var badgeW = 118, gap = 12, h = 64;
  var n = facts.length;
  var viewW = n * badgeW + (n - 1) * gap + 20;
  var inner = facts.map(function (f, i) {
    var x = 10 + i * (badgeW + gap);
    return '<rect x="' + x + '" y="10" width="' + badgeW + '" height="' + h + '" rx="14" fill="' + f.color + '" opacity="0.14" stroke="' + f.color + '" stroke-width="2"/>' +
      '<text x="' + (x + badgeW / 2) + '" y="38" font-size="12.5" font-weight="800" text-anchor="middle" fill="' + f.color + '">' + f.title + '</text>' +
      '<text x="' + (x + badgeW / 2) + '" y="58" font-size="10.5" font-weight="600" text-anchor="middle" fill="' + f.color + '">' + f.sub + '</text>';
  }).join('');
  return svgWrap(inner, viewW, 84, Math.min(viewW, 560), label);
}
/* กล่องขั้นตอนต่อเนื่องเชื่อมด้วยลูกศร — ใช้กับบทเรียนที่อธิบายลำดับ/กระบวนการ/ระยะ
   (steps: [{title, sub, color}, ...]) */
function svgFlowSteps(steps, label) {
  var boxW = 100, boxH = 54, gap = 36, y = 30;
  var n = steps.length;
  var viewW = n * boxW + (n - 1) * gap + 20;
  var parts = [];
  steps.forEach(function (s, i) {
    var x = 10 + i * (boxW + gap);
    parts.push('<rect x="' + x + '" y="' + y + '" width="' + boxW + '" height="' + boxH + '" rx="10" fill="' + s.color + '" opacity="0.9"/>');
    parts.push('<text x="' + (x + boxW / 2) + '" y="' + (y + boxH / 2 + 5) + '" font-size="12" font-weight="800" text-anchor="middle" fill="#FFFFFF">' + s.title + '</text>');
    if (s.sub) parts.push('<text x="' + (x + boxW / 2) + '" y="' + (y + boxH + 18) + '" font-size="10.5" text-anchor="middle" fill="#1F2430">' + s.sub + '</text>');
    if (i < n - 1) parts.push(svgArrow(x + boxW + 4, y + boxH / 2, x + boxW + gap - 4, y + boxH / 2, '#1F2430'));
  });
  return svgWrap(parts.join(''), viewW, y + boxH + 32, Math.min(viewW, 560), label);
}
/* สนามฟุตบอล + แผนการเล่น 4-4-2 (11 ตำแหน่ง: GK 1, DF 4, MF 4, FW 2) */
function buildFootballFormationSvg() {
  var positions = [
    { x: 130, y: 345, label: 'GK' },
    { x: 45, y: 280, label: 'LB' }, { x: 105, y: 280, label: 'CB' }, { x: 165, y: 280, label: 'CB' }, { x: 225, y: 280, label: 'RB' },
    { x: 45, y: 190, label: 'LM' }, { x: 105, y: 190, label: 'CM' }, { x: 165, y: 190, label: 'CM' }, { x: 225, y: 190, label: 'RM' },
    { x: 95, y: 95, label: 'ST' }, { x: 165, y: 95, label: 'ST' }
  ];
  var dots = positions.map(function (p) {
    return '<circle cx="' + p.x + '" cy="' + p.y + '" r="15" fill="#FFD43B" stroke="#1F2430" stroke-width="2"/>' +
      '<text x="' + p.x + '" y="' + (p.y + 5) + '" font-size="12" font-weight="800" text-anchor="middle" fill="#1F2430">' + p.label + '</text>';
  }).join('');
  var pitch = '<rect x="10" y="10" width="240" height="360" rx="4" fill="#2F9E44" stroke="#FFFFFF" stroke-width="2"/>' +
    '<line x1="10" y1="190" x2="250" y2="190" stroke="#FFFFFF" stroke-width="2"/>' +
    '<circle cx="130" cy="190" r="35" fill="none" stroke="#FFFFFF" stroke-width="2"/>' +
    '<rect x="80" y="20" width="100" height="50" fill="none" stroke="#FFFFFF" stroke-width="2"/>' +
    '<rect x="80" y="310" width="100" height="50" fill="none" stroke="#FFFFFF" stroke-width="2"/>';
  return svgWrap(pitch + dots, 260, 380, 280, 'football 4-4-2 formation diagram');
}
/* 3 เทคนิคการเตะบอลพื้นฐาน — ลูกศรแทนทิศทางเท้าที่สัมผัสบอล 3 จุด (หลังเท้า/ข้างในเท้า/ข้างนอกเท้า) */
function buildKickTechniqueSvg() {
  var ball = '<circle cx="140" cy="110" r="24" fill="#FFFFFF" stroke="#1F2430" stroke-width="2.5"/>' +
    '<polygon points="140,96 151,104 147,118 133,118 129,104" fill="#1F2430"/>';
  var arrows = svgArrow(140, 205, 140, 134, '#E8590C') +
    svgArrow(55, 195, 123, 127, '#2F9E44') +
    svgArrow(225, 195, 157, 127, '#1971C2');
  var labels = '<text x="140" y="222" font-size="13" font-weight="800" text-anchor="middle" fill="#E8590C">Instep</text>' +
    '<text x="45" y="212" font-size="13" font-weight="800" text-anchor="middle" fill="#2F9E44">Inside</text>' +
    '<text x="235" y="212" font-size="13" font-weight="800" text-anchor="middle" fill="#1971C2">Outside</text>';
  return svgWrap(arrows + ball + labels, 280, 230, 300, 'football kicking technique diagram');
}
/* ครึ่งสนามบาสเกตบอล + 5 ตำแหน่งหลัก (PG/SG/SF/PF/C) */
function buildBasketballPositionsSvg() {
  var positions = [
    { x: 130, y: 60, label: 'C' },
    { x: 185, y: 110, label: 'PF' }, { x: 75, y: 110, label: 'SF' },
    { x: 195, y: 200, label: 'SG' }, { x: 130, y: 255, label: 'PG' }
  ];
  var dots = positions.map(function (p) {
    return '<circle cx="' + p.x + '" cy="' + p.y + '" r="16" fill="#FFD43B" stroke="#1F2430" stroke-width="2"/>' +
      '<text x="' + p.x + '" y="' + (p.y + 5) + '" font-size="12" font-weight="800" text-anchor="middle" fill="#1F2430">' + p.label + '</text>';
  }).join('');
  var court = '<rect x="10" y="10" width="240" height="280" rx="4" fill="#D9822B" stroke="#FFFFFF" stroke-width="2"/>' +
    '<rect x="90" y="10" width="80" height="110" fill="none" stroke="#FFFFFF" stroke-width="2"/>' +
    '<circle cx="130" cy="120" r="35" fill="none" stroke="#FFFFFF" stroke-width="2"/>' +
    '<path d="M 25,235 Q 130,290 235,235" stroke="#FFFFFF" stroke-width="2" fill="none"/>' +
    '<line x1="105" y1="18" x2="155" y2="18" stroke="#1F2430" stroke-width="4"/>';
  return svgWrap(court + dots, 260, 300, 280, 'basketball 5 positions diagram');
}
/* มุมยิงในอุดมคติ (Shooting Arc) — เส้นวิถีโค้งจากลูกบอลไปห่วง พร้อมป้ายมุม */
function buildBasketballShotArcSvg() {
  var hoop = '<line x1="236" y1="18" x2="242" y2="66" stroke="#1F2430" stroke-width="5"/>' +
    '<ellipse cx="218" cy="60" rx="20" ry="6" fill="none" stroke="#E8590C" stroke-width="3"/>';
  var trajectory = '<path d="M 40,220 Q 90,40 216,58" stroke="#E8590C" stroke-width="3" fill="none" stroke-dasharray="7,5"/>';
  var ball = '<circle cx="40" cy="220" r="15" fill="#E8590C" stroke="#1F2430" stroke-width="2"/>' +
    '<line x1="40" y1="205" x2="40" y2="235" stroke="#1F2430" stroke-width="1.5"/>' +
    '<path d="M 25,220 Q 40,206 55,220" stroke="#1F2430" stroke-width="1.5" fill="none"/>' +
    '<path d="M 25,220 Q 40,234 55,220" stroke="#1F2430" stroke-width="1.5" fill="none"/>';
  var label = '<text x="90" y="150" font-size="14" font-weight="800" fill="#E8590C">~45-52°</text>';
  return svgWrap(trajectory + hoop + ball + label, 260, 240, 280, 'basketball ideal shooting arc diagram');
}
/* 6 โซนตำแหน่งวอลเลย์บอล + การหมุนตำแหน่ง — แถวหน้า (4,3,2) ใกล้ตาข่าย, แถวหลัง (5,6,1) ใกล้เส้นหลัง */
function buildVolleyballPositionsSvg() {
  var positions = [
    { x: 60, y: 55, label: '4' }, { x: 130, y: 55, label: '3' }, { x: 200, y: 55, label: '2' },
    { x: 60, y: 160, label: '5' }, { x: 130, y: 160, label: '6' }, { x: 200, y: 160, label: '1' }
  ];
  var dots = positions.map(function (p) {
    return '<circle cx="' + p.x + '" cy="' + p.y + '" r="18" fill="#FFD43B" stroke="#1F2430" stroke-width="2"/>' +
      '<text x="' + p.x + '" y="' + (p.y + 6) + '" font-size="15" font-weight="800" text-anchor="middle" fill="#1F2430">' + p.label + '</text>';
  }).join('');
  var court = '<rect x="10" y="10" width="240" height="190" fill="#2B6CB0" stroke="#FFFFFF" stroke-width="2"/>' +
    '<line x1="10" y1="10" x2="250" y2="10" stroke="#1F2430" stroke-width="6"/>' +
    '<line x1="10" y1="105" x2="250" y2="105" stroke="#FFFFFF" stroke-width="2" stroke-dasharray="5,5"/>';
  return svgWrap(court + dots, 260, 220, 280, 'volleyball 6 court zones diagram');
}
/* เทคนิครับลูกด้วยแขน (Forearm Pass) — แพลตฟอร์มแขน + ทิศทางบอลเข้า/ออก */
function buildVolleyballPassSvg() {
  var platform = '<line x1="95" y1="185" x2="205" y2="165" stroke="#1F2430" stroke-width="10" stroke-linecap="round"/>';
  var incoming = svgArrow(230, 40, 165, 158, '#1971C2');
  var outgoing = svgArrow(155, 165, 70, 60, '#E8590C');
  var labels = '<text x="235" y="30" font-size="12" font-weight="800" text-anchor="middle" fill="#1971C2">Incoming</text>' +
    '<text x="150" y="210" font-size="12" font-weight="800" text-anchor="middle" fill="#1F2430">Forearm Platform</text>' +
    '<text x="55" y="50" font-size="12" font-weight="800" text-anchor="middle" fill="#E8590C">To Setter</text>';
  return svgWrap(incoming + outgoing + platform + labels, 260, 220, 280, 'volleyball forearm pass technique diagram');
}
/* เส้นสนามแบดมินตัน: เดี่ยว (ส้ม, แคบ+ลึก) vs คู่ (น้ำเงิน, กว้าง+ตื้น) ซ้อนกันในสนามเดียว */
function buildBadmintonCourtSvg() {
  var singles = '#E8590C', doubles = '#1971C2';
  var courtBg = '<rect x="15" y="15" width="170" height="290" fill="#2F9E44"/>';
  var doublesBoundary = '<rect x="15" y="15" width="170" height="290" fill="none" stroke="' + doubles + '" stroke-width="3"/>';
  var singlesSidelines = '<line x1="35" y1="15" x2="35" y2="305" stroke="' + singles + '" stroke-width="2.5"/>' +
    '<line x1="165" y1="15" x2="165" y2="305" stroke="' + singles + '" stroke-width="2.5"/>';
  var shortServiceLines = '<line x1="15" y1="95" x2="185" y2="95" stroke="#FFFFFF" stroke-width="2"/>' +
    '<line x1="15" y1="225" x2="185" y2="225" stroke="#FFFFFF" stroke-width="2"/>';
  var doublesLongServiceLines = '<line x1="15" y1="45" x2="185" y2="45" stroke="' + doubles + '" stroke-width="2"/>' +
    '<line x1="15" y1="275" x2="185" y2="275" stroke="' + doubles + '" stroke-width="2"/>';
  var centerLine = '<line x1="100" y1="15" x2="100" y2="95" stroke="#FFFFFF" stroke-width="1.5"/>' +
    '<line x1="100" y1="225" x2="100" y2="305" stroke="#FFFFFF" stroke-width="1.5"/>';
  var net = '<line x1="10" y1="160" x2="190" y2="160" stroke="#1F2430" stroke-width="5"/>';
  /* legend วางเป็นคอลัมน์ทางขวาของสนาม (ไม่ใช่แถวใต้สนาม) กันข้อความล้นขอบ viewBox */
  var legend = '<circle cx="215" cy="140" r="6" fill="' + singles + '"/><text x="215" y="162" font-size="11" font-weight="700" text-anchor="middle" fill="' + singles + '">Singles</text>' +
    '<circle cx="215" cy="185" r="6" fill="' + doubles + '"/><text x="215" y="207" font-size="11" font-weight="700" text-anchor="middle" fill="' + doubles + '">Doubles</text>';
  return svgWrap(courtBg + doublesBoundary + singlesSidelines + shortServiceLines + doublesLongServiceLines + centerLine + net + legend, 260, 320, 240, 'badminton singles vs doubles court lines diagram');
}
/* 3 ประเภทลูกตีพื้นฐาน (มุมมองด้านข้าง): Clear (โด่งลึก) / Drop (หยอด) / Smash (ตบชัน) */
function buildBadmintonShotsSvg() {
  var ground = '<line x1="10" y1="180" x2="290" y2="180" stroke="#1F2430" stroke-width="2"/>';
  var net = '<line x1="150" y1="120" x2="150" y2="180" stroke="#1F2430" stroke-width="4"/>' +
    '<line x1="144" y1="120" x2="156" y2="120" stroke="#1F2430" stroke-width="3"/>';
  var player = '<circle cx="30" cy="172" r="7" fill="#FFD43B" stroke="#1F2430" stroke-width="2"/>';
  var clear = '<path d="M 30,172 Q 150,20 270,172" stroke="#1971C2" stroke-width="3" fill="none" stroke-dasharray="6,4"/>';
  var drop = '<path d="M 30,172 Q 95,95 175,165" stroke="#2F9E44" stroke-width="3" fill="none" stroke-dasharray="6,4"/>';
  var smash = svgArrow(60, 135, 230, 176, '#E8590C');
  var labels = '<text x="200" y="35" font-size="13" font-weight="800" text-anchor="middle" fill="#1971C2">Clear</text>' +
    '<text x="100" y="85" font-size="13" font-weight="800" text-anchor="middle" fill="#2F9E44">Drop</text>' +
    '<text x="175" y="150" font-size="13" font-weight="800" text-anchor="middle" fill="#E8590C">Smash</text>';
  return svgWrap(ground + net + clear + drop + smash + player + labels, 300, 200, 320, 'badminton clear drop smash shot trajectories diagram');
}
/* สนามเทนนิสฐาน (ใช้ร่วมกันทั้งไดอะแกรมเส้นสนามและไดอะแกรมทิศทางเสิร์ฟด้านล่าง):
   เส้นสนามเดี่ยว/คู่ (มี Doubles Alley เพิ่ม) + เส้นเสิร์ฟ + ช่องเสิร์ฟ 4 ช่อง */
function buildTennisCourtCoreSvg() {
  var courtBg = '<rect x="15" y="15" width="190" height="290" fill="#2F6DA6"/>';
  var doublesBoundary = '<rect x="15" y="15" width="190" height="290" fill="none" stroke="#FFFFFF" stroke-width="3"/>';
  var singlesSidelines = '<line x1="35" y1="15" x2="35" y2="305" stroke="#FFFFFF" stroke-width="2"/>' +
    '<line x1="185" y1="15" x2="185" y2="305" stroke="#FFFFFF" stroke-width="2"/>';
  var serviceLines = '<line x1="35" y1="95" x2="185" y2="95" stroke="#FFFFFF" stroke-width="2"/>' +
    '<line x1="35" y1="225" x2="185" y2="225" stroke="#FFFFFF" stroke-width="2"/>';
  var centerServiceLine = '<line x1="110" y1="95" x2="110" y2="160" stroke="#FFFFFF" stroke-width="2"/>' +
    '<line x1="110" y1="160" x2="110" y2="225" stroke="#FFFFFF" stroke-width="2"/>';
  var net = '<line x1="10" y1="160" x2="210" y2="160" stroke="#1F2430" stroke-width="5"/>';
  return courtBg + doublesBoundary + singlesSidelines + serviceLines + centerServiceLine + net;
}
function buildTennisCourtSvg() {
  return svgWrap(buildTennisCourtCoreSvg(), 220, 320, 220, 'tennis court lines and service boxes diagram');
}
/* ทิศทางการเสิร์ฟ — เสิร์ฟต้องข้ามทแยงมุมเสมอ ไม่เคยตรงหน้าผู้เสิร์ฟ (ขวา=คะแนนคู่, ซ้าย=คะแนนคี่) */
function buildTennisServeSvg() {
  var rightServe = svgArrow(150, 22, 72, 130, '#E8590C');
  var leftServe = svgArrow(70, 22, 148, 130, '#1971C2');
  var labels = '<text x="150" y="14" font-size="11" font-weight="800" text-anchor="middle" fill="#E8590C">Even→Right</text>' +
    '<text x="70" y="14" font-size="11" font-weight="800" text-anchor="middle" fill="#1971C2">Odd→Left</text>';
  return svgWrap(buildTennisCourtCoreSvg() + rightServe + leftServe + labels, 220, 320, 220, 'tennis serve direction diagram');
}
/* โซนเพรสสูง (ใกล้ประตูคู่แข่ง) vs โซนบล็อกต่ำ (ใกล้ประตูตัวเอง) บนสนามฟุตบอลเดียวกับแผนการเล่น */
function buildFootballPressingSvg() {
  var pitch = '<rect x="10" y="10" width="240" height="360" rx="4" fill="#2F9E44" stroke="#FFFFFF" stroke-width="2"/>' +
    '<line x1="10" y1="190" x2="250" y2="190" stroke="#FFFFFF" stroke-width="2"/>' +
    '<circle cx="130" cy="190" r="35" fill="none" stroke="#FFFFFF" stroke-width="2"/>' +
    '<rect x="80" y="20" width="100" height="50" fill="none" stroke="#FFFFFF" stroke-width="2"/>' +
    '<rect x="80" y="310" width="100" height="50" fill="none" stroke="#FFFFFF" stroke-width="2"/>';
  var highPressZone = '<rect x="20" y="20" width="220" height="120" fill="#E8590C" opacity="0.32"/>' +
    '<text x="130" y="45" font-size="12" font-weight="800" text-anchor="middle" fill="#7A2E06">High Press Zone</text>';
  var lowBlockZone = '<rect x="20" y="250" width="220" height="120" fill="#1971C2" opacity="0.32"/>' +
    '<text x="130" y="365" font-size="12" font-weight="800" text-anchor="middle" fill="#0B3D6B">Low Block Zone</text>';
  var arrow = svgArrow(130, 320, 130, 160, '#FFD43B');
  return svgWrap(pitch + highPressZone + lowBlockZone + arrow, 260, 380, 280, 'football high press zone near opponent goal vs low block zone near own goal diagram');
}
/* เกมรับแบบโซน 2-3 (แนวหน้า 2 คนใกล้เส้นสามคะแนน แนวหลัง 3 คนใกล้ห่วง) */
function buildBasketballZoneDefenseSvg() {
  var positions = [
    { x: 80, y: 55 }, { x: 180, y: 55 },
    { x: 45, y: 175 }, { x: 130, y: 200 }, { x: 215, y: 175 }
  ];
  var dots = positions.map(function (p) {
    return '<circle cx="' + p.x + '" cy="' + p.y + '" r="14" fill="#1971C2" stroke="#1F2430" stroke-width="2"/>' +
      '<text x="' + p.x + '" y="' + (p.y + 5) + '" font-size="11" font-weight="800" text-anchor="middle" fill="#FFFFFF">D</text>';
  }).join('');
  var court = '<rect x="10" y="10" width="240" height="280" rx="4" fill="#D9822B" stroke="#FFFFFF" stroke-width="2"/>' +
    '<rect x="90" y="10" width="80" height="110" fill="none" stroke="#FFFFFF" stroke-width="2"/>' +
    '<circle cx="130" cy="120" r="35" fill="none" stroke="#FFFFFF" stroke-width="2"/>' +
    '<path d="M 25,235 Q 130,290 235,235" stroke="#FFFFFF" stroke-width="2" fill="none"/>' +
    '<line x1="105" y1="18" x2="155" y2="18" stroke="#1F2430" stroke-width="4"/>';
  var label = '<text x="130" y="270" font-size="13" font-weight="800" text-anchor="middle" fill="#1F2430">2-3 Zone Defense</text>';
  return svgWrap(court + dots + label, 260, 300, 280, 'basketball 2-3 zone defense positions diagram');
}
/* ก้าวเข้าตบบอล 3 ก้าว → กระโดด → ตบบอลข้ามตาข่ายลงแดนคู่แข่ง */
function buildVolleyballSpikeApproachSvg() {
  var ground = '<line x1="10" y1="190" x2="290" y2="190" stroke="#1F2430" stroke-width="2"/>';
  var net = '<line x1="230" y1="40" x2="230" y2="190" stroke="#1F2430" stroke-width="5"/>';
  var steps = [{ x: 40, y: 185, label: '1' }, { x: 80, y: 182, label: '2' }, { x: 120, y: 178, label: '3' }];
  var footprints = steps.map(function (s) {
    return '<ellipse cx="' + s.x + '" cy="' + s.y + '" rx="10" ry="6" fill="#FFD43B" stroke="#1F2430" stroke-width="1.5"/>' +
      '<text x="' + s.x + '" y="' + (s.y + 4) + '" font-size="9" font-weight="800" text-anchor="middle" fill="#1F2430">' + s.label + '</text>';
  }).join('');
  var jumpArrow = svgArrow(150, 178, 175, 90, '#2F9E44');
  var attackArrow = svgArrow(180, 85, 255, 165, '#E8590C');
  var labels = '<text x="150" y="205" font-size="12" font-weight="800" text-anchor="middle" fill="#1F2430">Approach Steps</text>' +
    '<text x="205" y="75" font-size="12" font-weight="800" text-anchor="middle" fill="#2F9E44">Jump</text>' +
    '<text x="255" y="150" font-size="12" font-weight="800" text-anchor="middle" fill="#E8590C">Attack</text>';
  return svgWrap(ground + net + footprints + jumpArrow + attackArrow + labels, 300, 220, 320, 'volleyball spike approach steps and attack trajectory diagram');
}
/* รูปแบบยืนคู่: หน้า-หลัง (รุก) เทียบกับ ซ้าย-ขวา (รับ) สองสนามจำลองข้างกัน */
function buildBadmintonDoublesFormationSvg() {
  function miniCourt(offsetX, dots, label) {
    var court = '<rect x="' + offsetX + '" y="20" width="110" height="220" fill="#2F9E44" stroke="#FFFFFF" stroke-width="2"/>' +
      '<line x1="' + offsetX + '" y1="130" x2="' + (offsetX + 110) + '" y2="130" stroke="#1F2430" stroke-width="4"/>';
    var d = dots.map(function (p) {
      return '<circle cx="' + (offsetX + p.x) + '" cy="' + p.y + '" r="12" fill="#FFD43B" stroke="#1F2430" stroke-width="2"/>';
    }).join('');
    var lbl = '<text x="' + (offsetX + 55) + '" y="258" font-size="11" font-weight="800" text-anchor="middle" fill="#1F2430">' + label + '</text>';
    return court + d + lbl;
  }
  var frontBack = miniCourt(15, [{ x: 55, y: 60 }, { x: 55, y: 100 }], 'Front-Back (Attack)');
  var sideBySide = miniCourt(165, [{ x: 35, y: 80 }, { x: 75, y: 80 }], 'Side-by-Side (Defense)');
  return svgWrap(frontBack + sideBySide, 300, 280, 320, 'badminton doubles formations: front-back attacking vs side-by-side defensive diagram');
}
/* โซนวอลเลย์ใกล้ตาข่าย vs โซนกราวด์สโตรกใกล้เส้นหลัง บนสนามเทนนิสฐานเดียวกัน */
function buildTennisShotZonesSvg() {
  var core = buildTennisCourtCoreSvg();
  var volleyZone = '<rect x="15" y="130" width="190" height="60" fill="#FFD43B" opacity="0.35"/>' +
    '<text x="110" y="163" font-size="12" font-weight="800" text-anchor="middle" fill="#7A5B00">Volley Zone</text>';
  var groundZone = '<rect x="15" y="225" width="190" height="80" fill="#E8590C" opacity="0.3"/>' +
    '<text x="110" y="270" font-size="12" font-weight="800" text-anchor="middle" fill="#7A2E06">Groundstroke Zone</text>';
  return svgWrap(core + volleyZone + groundZone, 220, 320, 220, 'tennis court zones: volley near net vs groundstrokes from baseline diagram');
}
/* โต๊ะเทเบิลเทนนิสมองจากด้านบน: ตาข่าย + เส้นกลางโต๊ะสำหรับการเสิร์ฟประเภทคู่ */
function buildTableTennisTableSvg() {
  var table = '<rect x="15" y="15" width="220" height="140" fill="#1971C2" stroke="#FFFFFF" stroke-width="3"/>';
  var centerLine = '<line x1="125" y1="15" x2="125" y2="155" stroke="#FFFFFF" stroke-width="1.5" stroke-dasharray="4,4"/>';
  var net = '<line x1="15" y1="85" x2="235" y2="85" stroke="#1F2430" stroke-width="5"/>';
  var labels = '<text x="240" y="89" font-size="12" font-weight="800" text-anchor="start" fill="#1F2430">Net</text>' +
    '<text x="125" y="172" font-size="11" font-weight="700" text-anchor="middle" fill="#1F2430">Center Line (doubles serve)</text>';
  return svgWrap(table + centerLine + net + labels, 280, 190, 300, 'table tennis table layout with net and center line for doubles diagram');
}
/* Topspin (ลูกม้วนหน้า) จมเร็วหลังข้ามตาข่าย เทียบกับ Backspin (ลูกตัด) ที่ลอยและตกช้ากว่า */
function buildTableTennisSpinSvg() {
  var net = '<line x1="150" y1="10" x2="150" y2="170" stroke="#1F2430" stroke-width="3"/>';
  function ball(cx, cy) { return '<circle cx="' + cx + '" cy="' + cy + '" r="11" fill="#FFFFFF" stroke="#1F2430" stroke-width="2"/>'; }
  function spinArc(cx, cy, color, sweepFlag) {
    return '<path d="M ' + (cx - 8) + ' ' + (cy - 7) + ' A 9 9 0 1 ' + sweepFlag + ' ' + (cx - 8) + ' ' + (cy + 7) + '" stroke="' + color + '" stroke-width="2" fill="none"/>';
  }
  var topBall = ball(40, 45);
  var topSpin = spinArc(40, 45, '#E8590C', 1);
  var topArrow = svgArrow(55, 45, 200, 95, '#E8590C');
  var topLabel = '<text x="150" y="20" font-size="12" font-weight="800" text-anchor="middle" fill="#E8590C">Topspin: dips down fast after crossing</text>';
  var bottomBall = ball(40, 135);
  var bottomSpin = spinArc(40, 135, '#1971C2', 0);
  var bottomArrow = svgArrow(55, 135, 220, 140, '#1971C2');
  var bottomLabel = '<text x="150" y="165" font-size="12" font-weight="800" text-anchor="middle" fill="#1971C2">Backspin: floats longer, sinks late</text>';
  return svgWrap(net + topBall + topSpin + topArrow + topLabel + bottomBall + bottomSpin + bottomArrow + bottomLabel, 280, 180, 300, 'table tennis topspin vs backspin trajectory diagram');
}
/* เป้ากลาง + 4 หมัดพื้นฐาน: Jab/Cross เป็นเส้นตรง, Hook/Uppercut เป็นเส้นโค้ง */
function buildBoxingPunchAnglesSvg() {
  var target = '<circle cx="150" cy="110" r="28" fill="#FFFFFF" stroke="#1F2430" stroke-width="2.5"/>';
  var jab = svgArrow(20, 110, 118, 110, '#1971C2');
  var cross = svgArrow(280, 110, 182, 110, '#E8590C');
  var hook = '<path d="M 55,190 Q 90,130 122,120" stroke="#2F9E44" stroke-width="3" fill="none" stroke-dasharray="6,4"/>';
  var uppercut = '<path d="M 150,225 Q 168,180 150,142" stroke="#F5A524" stroke-width="3" fill="none" stroke-dasharray="6,4"/>';
  var labels = '<text x="70" y="95" font-size="12" font-weight="800" text-anchor="middle" fill="#1971C2">Jab</text>' +
    '<text x="230" y="95" font-size="12" font-weight="800" text-anchor="middle" fill="#E8590C">Cross</text>' +
    '<text x="55" y="205" font-size="12" font-weight="800" text-anchor="middle" fill="#2F9E44">Hook</text>' +
    '<text x="150" y="240" font-size="12" font-weight="800" text-anchor="middle" fill="#F5A524">Uppercut</text>';
  return svgWrap(target + jab + cross + hook + uppercut + labels, 300, 250, 320, 'boxing four basic punch angles: jab, cross, hook, uppercut diagram');
}
/* 3 ขั้นตอนของการทุ่มยูโด: Kuzushi (ทำลายสมดุล) → Tsukuri (เข้าตำแหน่ง) → Kake (ทุ่มจริง) */
function buildJudoThrowPhasesSvg() {
  function box(x, label, color) {
    return '<rect x="' + x + '" y="60" width="70" height="50" rx="8" fill="' + color + '" opacity="0.88"/>' +
      '<text x="' + (x + 35) + '" y="90" font-size="12" font-weight="800" text-anchor="middle" fill="#FFFFFF">' + label + '</text>';
  }
  var b1 = box(10, 'Kuzushi', '#1971C2');
  var b2 = box(115, 'Tsukuri', '#2F9E44');
  var b3 = box(220, 'Kake', '#E8590C');
  var a1 = svgArrow(80, 85, 113, 85, '#1F2430');
  var a2 = svgArrow(185, 85, 218, 85, '#1F2430');
  var labels = '<text x="45" y="130" font-size="11" text-anchor="middle" fill="#1F2430">Off-balance</text>' +
    '<text x="150" y="130" font-size="11" text-anchor="middle" fill="#1F2430">Position</text>' +
    '<text x="255" y="130" font-size="11" text-anchor="middle" fill="#1F2430">Execute</text>';
  return svgWrap(b1 + b2 + b3 + a1 + a2 + labels, 300, 150, 320, 'judo throw phases: kuzushi tsukuri kake flow diagram');
}
/* ท่ามวยไทยแบบเคลื่อนไหว (ให้ผู้เรียนดูแล้วทำตามได้) — สร้างจากท่าเดียวกัน (การ์ดยืน)
   แล้วขยับแขน/ขาแค่จุดเดียวต่อท่าด้วย <animateTransform> (SMIL) หมุนรอบข้อต่อจริง
   (สะโพก/เข่า/ไหล่/ศอก) วนซ้ำไม่รู้จบ อ้างอิงขั้นตอนจริงจากงานวิจัยออนไลน์:
   Roundhouse Kick (ยกเข่าเข้าหาลำตัว หมุนสะโพก เหวี่ยงหน้าแข้งออก), Teep (ยกเข่าสูง
   ดันสะโพกออกด้วยปลายเท้า), Jab-Cross (หมัดหน้าพุ่งตรงก่อน ตามด้วยหมัดหลังหมุนสะโพก) */
function buildMuayThaiTechniqueDemoSvg() {
  function baseFigure(ox) {
    return '<line x1="' + (ox + 98) + '" y1="42" x2="' + (ox + 86) + '" y2="95" stroke="#1F2430" stroke-width="4" stroke-linecap="round"/>' +
      '<circle cx="' + (ox + 98) + '" cy="30" r="10" fill="#FFD43B" stroke="#1F2430" stroke-width="2"/>';
  }
  function groundLine(ox) { return '<line x1="' + (ox + 6) + '" y1="165" x2="' + (ox + 154) + '" y2="165" stroke="#94a3b8" stroke-width="2"/>'; }
  function caption(ox, text) { return '<text x="' + (ox + 80) + '" y="195" font-size="13" font-weight="800" text-anchor="middle" fill="#1F2430">' + text + '</text>'; }
  /* ขาคู่ที่ยืนอยู่กับที่ (ไม่ขยับ) ใช้ร่วมกันทั้ง 3 ท่า — เฉพาะขา/แขนที่เป็นจุดเด่นของแต่ละ
     เทคนิคเท่านั้นที่หมุนเคลื่อนไหว */
  function standingLeg(ox) {
    return '<line x1="' + (ox + 86) + '" y1="95" x2="' + (ox + 100) + '" y2="122" stroke="#1F2430" stroke-width="5" stroke-linecap="round"/>' +
      '<line x1="' + (ox + 100) + '" y1="122" x2="' + (ox + 107) + '" y2="152" stroke="#1F2430" stroke-width="5" stroke-linecap="round"/>';
  }
  function animRotate(values, keyTimes, dur) {
    return '<animateTransform attributeName="transform" type="rotate" values="' + values + '" keyTimes="' + keyTimes + '" dur="' + dur + '" repeatCount="indefinite"/>';
  }
  /* --- แผง 1: Roundhouse Kick — ยกเข่าเข้าหมุนสะโพก แล้วเหวี่ยงหน้าแข้งออก --- */
  function panelRoundhouse(ox) {
    var leadArm = '<line x1="' + (ox + 96) + '" y1="46" x2="' + (ox + 112) + '" y2="60" stroke="#1F2430" stroke-width="4" stroke-linecap="round"/>' +
      '<line x1="' + (ox + 112) + '" y1="60" x2="' + (ox + 105) + '" y2="38" stroke="#1F2430" stroke-width="4" stroke-linecap="round"/>';
    var rearArm = '<g><line x1="' + (ox + 96) + '" y1="46" x2="' + (ox + 78) + '" y2="60" stroke="#1F2430" stroke-width="4" stroke-linecap="round"/>' +
      '<line x1="' + (ox + 78) + '" y1="60" x2="' + (ox + 86) + '" y2="44" stroke="#1F2430" stroke-width="4" stroke-linecap="round"/>' +
      animRotate('0 ' + (ox + 96) + ' 46; -35 ' + (ox + 96) + ' 46; 0 ' + (ox + 96) + ' 46; 0 ' + (ox + 96) + ' 46', '0;0.5;0.7;1', '2s') + '</g>';
    var kickLeg = '<g><line x1="' + (ox + 86) + '" y1="95" x2="' + (ox + 68) + '" y2="122" stroke="#1F2430" stroke-width="5" stroke-linecap="round"/>' +
      '<g><line x1="' + (ox + 68) + '" y1="122" x2="' + (ox + 60) + '" y2="150" stroke="#1F2430" stroke-width="5" stroke-linecap="round"/>' +
      animRotate('0 ' + (ox + 68) + ' 122; 55 ' + (ox + 68) + ' 122; 0 ' + (ox + 68) + ' 122; 0 ' + (ox + 68) + ' 122', '0;0.5;0.7;1', '2s') + '</g>' +
      animRotate('0 ' + (ox + 86) + ' 95; -75 ' + (ox + 86) + ' 95; 0 ' + (ox + 86) + ' 95; 0 ' + (ox + 86) + ' 95', '0;0.5;0.7;1', '2s') + '</g>';
    return groundLine(ox) + caption(ox, 'Roundhouse Kick') + baseFigure(ox) + leadArm + rearArm + standingLeg(ox) + kickLeg;
  }
  /* --- แผง 2: Teep (เตะถีบ) — ยกเข่าสูงแล้วดันสะโพกออกด้วยปลายเท้า --- */
  function panelTeep(ox) {
    var leadArm = '<line x1="' + (ox + 96) + '" y1="46" x2="' + (ox + 112) + '" y2="60" stroke="#1F2430" stroke-width="4" stroke-linecap="round"/>' +
      '<line x1="' + (ox + 112) + '" y1="60" x2="' + (ox + 105) + '" y2="38" stroke="#1F2430" stroke-width="4" stroke-linecap="round"/>';
    var rearArm = '<g><line x1="' + (ox + 96) + '" y1="46" x2="' + (ox + 78) + '" y2="60" stroke="#1F2430" stroke-width="4" stroke-linecap="round"/>' +
      '<line x1="' + (ox + 78) + '" y1="60" x2="' + (ox + 86) + '" y2="44" stroke="#1F2430" stroke-width="4" stroke-linecap="round"/>' +
      animRotate('0 ' + (ox + 96) + ' 46; -20 ' + (ox + 96) + ' 46; 0 ' + (ox + 96) + ' 46; 0 ' + (ox + 96) + ' 46', '0;0.5;0.7;1', '2s') + '</g>';
    var teepLeg = '<g><line x1="' + (ox + 86) + '" y1="95" x2="' + (ox + 68) + '" y2="122" stroke="#1F2430" stroke-width="5" stroke-linecap="round"/>' +
      '<g><line x1="' + (ox + 68) + '" y1="122" x2="' + (ox + 60) + '" y2="150" stroke="#1F2430" stroke-width="5" stroke-linecap="round"/>' +
      animRotate('0 ' + (ox + 68) + ' 122; 95 ' + (ox + 68) + ' 122; 0 ' + (ox + 68) + ' 122; 0 ' + (ox + 68) + ' 122', '0;0.5;0.7;1', '2s') + '</g>' +
      animRotate('0 ' + (ox + 86) + ' 95; -55 ' + (ox + 86) + ' 95; 0 ' + (ox + 86) + ' 95; 0 ' + (ox + 86) + ' 95', '0;0.5;0.7;1', '2s') + '</g>';
    return groundLine(ox) + caption(ox, 'Teep (Push Kick)') + baseFigure(ox) + leadArm + rearArm + standingLeg(ox) + teepLeg;
  }
  /* --- แผง 3: Jab-Cross — หมัดหน้าพุ่งตรงก่อน ตามด้วยหมัดหลังหมุนสะโพก/ไหล่ --- */
  function panelJabCross(ox) {
    var jabArm = '<g><line x1="' + (ox + 96) + '" y1="46" x2="' + (ox + 112) + '" y2="60" stroke="#1F2430" stroke-width="4" stroke-linecap="round"/>' +
      '<g><line x1="' + (ox + 112) + '" y1="60" x2="' + (ox + 105) + '" y2="38" stroke="#1F2430" stroke-width="4" stroke-linecap="round"/>' +
      animRotate('0 ' + (ox + 112) + ' 60; -70 ' + (ox + 112) + ' 60; 0 ' + (ox + 112) + ' 60; 0 ' + (ox + 112) + ' 60; 0 ' + (ox + 112) + ' 60', '0;0.2;0.4;0.6;1', '2s') + '</g>' +
      animRotate('0 ' + (ox + 96) + ' 46; 30 ' + (ox + 96) + ' 46; 0 ' + (ox + 96) + ' 46; 0 ' + (ox + 96) + ' 46; 0 ' + (ox + 96) + ' 46', '0;0.2;0.4;0.6;1', '2s') + '</g>';
    var crossArm = '<g><line x1="' + (ox + 96) + '" y1="46" x2="' + (ox + 78) + '" y2="60" stroke="#1F2430" stroke-width="4" stroke-linecap="round"/>' +
      '<g><line x1="' + (ox + 78) + '" y1="60" x2="' + (ox + 86) + '" y2="44" stroke="#1F2430" stroke-width="4" stroke-linecap="round"/>' +
      animRotate('0 ' + (ox + 78) + ' 60; 0 ' + (ox + 78) + ' 60; -85 ' + (ox + 78) + ' 60; 0 ' + (ox + 78) + ' 60; 0 ' + (ox + 78) + ' 60', '0;0.4;0.6;0.8;1', '2s') + '</g>' +
      animRotate('0 ' + (ox + 96) + ' 46; 0 ' + (ox + 96) + ' 46; -35 ' + (ox + 96) + ' 46; 0 ' + (ox + 96) + ' 46; 0 ' + (ox + 96) + ' 46', '0;0.4;0.6;0.8;1', '2s') + '</g>';
    return groundLine(ox) + caption(ox, 'Jab - Cross') + baseFigure(ox) + jabArm + crossArm + standingLeg(ox) + '<line x1="' + (ox + 86) + '" y1="95" x2="' + (ox + 68) + '" y2="122" stroke="#1F2430" stroke-width="5" stroke-linecap="round"/>' +
      '<line x1="' + (ox + 68) + '" y1="122" x2="' + (ox + 60) + '" y2="150" stroke="#1F2430" stroke-width="5" stroke-linecap="round"/>';
  }
  return svgWrap(panelRoundhouse(0) + panelTeep(165) + panelJabCross(330), 480, 210, 480,
    'animated muay thai technique demo: roundhouse kick, teep push kick, and jab-cross combination looping so learners can follow along');
}

var TRACKS = [
  {
    id: 'football-basics',
    label: { th: 'ฟุตบอล: กติกาพื้นฐาน', en: 'Football: Basic Rules' },
    group: { th: 'ฟุตบอล', en: 'Football' },
    items: [
      readingItem('รู้จักฟุตบอล', 'Meet Football',
        [
          'ฟุตบอล (Football/Soccer) เป็นกีฬาที่มีผู้ชมมากที่สุดในโลก แข่งกันระหว่าง 2 ทีม ทีมละ 11 คนในสนาม (รวมผู้รักษาประตู) เป้าหมายคือเตะบอลเข้าประตูฝ่ายตรงข้ามให้ได้มากกว่า',
          'การแข่งขันแบ่งเป็น 2 ครึ่ง ครึ่งละ 45 นาที (รวม 90 นาที) มีพักครึ่งเวลาสั้นๆ ระหว่างสองครึ่ง กรรมการอาจทดเวลาบาดเจ็บ (stoppage time) เพิ่มท้ายแต่ละครึ่งเพื่อชดเชยเวลาที่เสียไป',
          'ผู้เล่นห้ามใช้มือหรือแขนสัมผัสบอล (ยกเว้นผู้รักษาประตูในเขตโทษของทีมตัวเอง) ต้องใช้เท้า หัว หรือส่วนอื่นของร่างกายแทน'
        ],
        [
          "Football (Soccer) is the world's most-watched sport, played between 2 teams of 11 players each on the field (including the goalkeeper). The goal is to kick the ball into the opponent's net more times than they score against you.",
          'A match is split into 2 halves, 45 minutes each (90 minutes total), with a short halftime break between them. The referee may add stoppage time at the end of each half to compensate for time lost.',
          'Players may not touch the ball with their hands or arms (except the goalkeeper inside their own penalty area) — they must use their feet, head, or other body parts instead.'
        ],
        svgFactStrip([
          { title: '11 v 11', sub: 'players per side', color: '#2F9E44' },
          { title: '2 x 45 min', sub: 'match halves', color: '#2F9E44' },
          { title: '🚫 Hands', sub: 'outfield players', color: '#E8590C' }
        ], 'football match facts: 11 vs 11, 2x45 minutes, no hands')),
      readingItem('การล้ำหน้าและใบเหลือง-แดง', 'Offside & Cards',
        [
          "กติกาล้ำหน้า (Offside): ผู้เล่นจะ 'ล้ำหน้า' ถ้าอยู่ใกล้ประตูคู่แข่งกว่าบอลและกว่าผู้เล่นฝ่ายตรงข้ามคนรองสุดท้าย (ปกติคือกองหลัง) ในจังหวะที่เพื่อนร่วมทีมส่งบอลมาให้ — ถ้าล้ำหน้าแล้วรับบอล กรรมการจะเป่าฟาวล์",
          'ใบเหลือง (Yellow Card) คือการเตือนสำหรับการทำผิดกติการุนแรงระดับหนึ่ง ถ้าผู้เล่นคนเดิมได้ใบเหลือง 2 ใบในเกมเดียวกัน จะกลายเป็นใบแดงอัตโนมัติและถูกไล่ออกจากสนาม',
          'ใบแดง (Red Card) คือการไล่ออกจากสนามทันที ทีมที่โดนไล่ออกต้องเล่นต่อด้วยผู้เล่นน้อยกว่าคู่แข่ง 1 คนตลอดเกมที่เหลือ ไม่สามารถส่งตัวสำรองลงแทนได้'
        ],
        [
          "The Offside rule: a player is 'offside' if they are nearer to the opponent's goal than both the ball and the second-to-last opponent (usually a defender) at the moment a teammate passes to them — receiving the ball while offside gets whistled as a foul.",
          'A Yellow Card is a warning for a moderately serious rule violation. If the same player receives 2 yellow cards in one match, it automatically becomes a red card and they are sent off.',
          'A Red Card means immediate ejection from the match. The team that gets a player sent off must play the rest of the match with one fewer player and cannot bring on a substitute to replace them.'
        ],
        svgFactStrip([
          { title: 'Offside', sub: 'nearer goal than ball+DF', color: '#F5A524' },
          { title: '🟨🟨 = 🟥', sub: '2 yellows = red', color: '#E8590C' },
          { title: '🟥 Sent Off', sub: 'play a man down', color: '#C92A2A' }
        ], 'football offside and card rules diagram')),
      readingItem('ตำแหน่งผู้เล่นและแผนการเล่น 4-4-2', 'Player Positions & the 4-4-2 Formation',
        [
          "แผนการเล่น (Formation) คือการจัดตำแหน่งผู้เล่น 11 คนในสนาม แผนยอดนิยมแบบหนึ่งคือ '4-4-2' หมายถึงกองหลัง 4 คน กองกลาง 4 คน กองหน้า 2 คน (ไม่รวมผู้รักษาประตู)",
          'กองหลัง (Defender, DF) มีหน้าที่หลักคือป้องกันไม่ให้คู่แข่งเข้าใกล้ประตูตัวเอง — กองกลาง (Midfielder, MF) เชื่อมเกมระหว่างแนวรับกับแนวรุก ทั้งช่วยป้องกันและช่วยสร้างโอกาสทำประตู — กองหน้า (Forward, FW) มีหน้าที่หลักคือจบสกอร์ทำประตู',
          'ดูไดอะแกรมด้านล่าง: ตำแหน่งเรียงจากผู้รักษาประตู (GK) ด้านล่างสุด ขึ้นไปจนถึงกองหน้า (ST) ด้านบนสุด — ทีมจริงปรับแผนการเล่นเป็นแบบอื่นได้ เช่น 4-3-3 หรือ 3-5-2 ขึ้นอยู่กับกลยุทธ์'
        ],
        [
          "A Formation is how a team arranges its 11 players on the field. One popular formation is '4-4-2', meaning 4 defenders, 4 midfielders, and 2 forwards (not counting the goalkeeper).",
          'Defenders (DF) mainly stop the opponent from getting close to their own goal. Midfielders (MF) link defense and attack, helping both defend and create scoring chances. Forwards (FW) are mainly responsible for finishing and scoring goals.',
          'See the diagram below: positions run from the Goalkeeper (GK) at the bottom up to the Forwards (ST) at the top. Real teams use other formations too, like 4-3-3 or 3-5-2, depending on strategy.'
        ],
        buildFootballFormationSvg()),
      readingItem('เทคนิคการเตะบอลพื้นฐาน 3 แบบ', '3 Basic Kicking Techniques',
        [
          "เตะแบบ Instep (หลังเท้า): สัมผัสบอลด้วยหลังเท้า (บริเวณเชือกรองเท้า) เตะตรงจากด้านหลังบอล ให้แรงพุ่งตรงและรุนแรงที่สุด นิยมใช้ยิงประตูหรือส่งบอลไกล",
          "เตะแบบ Inside (ข้างเท้าด้านใน): สัมผัสบอลด้วยข้างเท้าด้านใน (บริเวณอุ้งเท้า) พื้นที่สัมผัสกว้างที่สุด ควบคุมทิศทางได้แม่นยำ นิยมใช้ส่งบอลระยะสั้น-กลาง",
          "เตะแบบ Outside (ข้างเท้าด้านนอก): สัมผัสบอลด้วยข้างเท้าด้านนอก ทำให้บอลหมุนและโค้งวิ่งหลบแนวรับหรือหลบผู้รักษาประตูได้ นิยมใช้เตะฟรีคิกโค้งหรือส่งบอลหลอกทิศทาง"
        ],
        [
          "Instep kick (laces): the ball is struck with the top of the foot (where the shoelaces are), straight from behind — the most powerful and direct strike, commonly used for shooting or long passes.",
          "Inside-foot kick: the ball is struck with the inside of the foot (the arch area), which has the widest contact surface for the most accurate direction control — commonly used for short-to-medium passes.",
          "Outside-foot kick: the ball is struck with the outside of the foot, putting spin on the ball so it curves around defenders or the goalkeeper — commonly used for curling free kicks or disguising the pass direction."
        ],
        buildKickTechniqueSvg()),
      readingItem('ลูกตั้งเตะและการเริ่มเกมใหม่', 'Restarts: Throw-ins, Corners, Free Kicks & Penalties',
        [
          'เมื่อบอลออกนอกเส้นข้างสนาม จะเริ่มเกมใหม่ด้วยการทุ่ม (Throw-in) โดยทีมที่ไม่ได้แตะบอลเป็นคนสุดท้าย ผู้เล่นต้องใช้สองมือทุ่มบอลข้ามศีรษะจากจุดที่บอลออก เท้าทั้งสองต้องแตะพื้นนอกสนามขณะทุ่ม',
          'เมื่อบอลออกนอกเส้นประตู (หลังประตู) ถ้าฝ่ายรุกเป็นคนแตะบอลออกครั้งสุดท้าย ฝ่ายรับจะได้ Goal Kick (เตะจากในกรอบเขตประตูของตัวเอง) แต่ถ้าฝ่ายรับแตะบอลออกครั้งสุดท้าย ฝ่ายรุกจะได้ Corner Kick (เตะจากมุมสนามฝั่งที่บอลออก)',
          'ฟรีคิก (Free Kick) แบ่งเป็น 2 แบบ: Direct Free Kick (เตะตรงเข้าประตูได้เลยโดยไม่ต้องมีใครแตะก่อน) ให้สำหรับฟาวล์รุนแรง เช่น ดันหรือสกัดขา ส่วน Indirect Free Kick (ต้องมีผู้เล่นอีกคนแตะบอลก่อนจึงจะนับเป็นประตูได้) ให้สำหรับความผิดที่เบากว่า เช่น ล้ำหน้าหรือผู้รักษาประตูถือบอลนานเกินไป',
          'จุดโทษ (Penalty Kick) ให้เมื่อฝ่ายรับทำฟาวล์ในเขตโทษของตัวเอง เตะจากจุดโทษโดยมีเพียงผู้รักษาประตูคอยป้องกัน ถือเป็นโอกาสทำประตูที่มีโอกาสสูงที่สุดในเกม',
          'การเปลี่ยนตัวผู้เล่น (Substitution): แต่ละทีมเปลี่ยนตัวได้จำนวนจำกัดต่อเกม (ปกติ 3-5 คนแล้วแต่การแข่งขัน) ผู้เล่นที่ถูกเปลี่ยนออกแล้วจะกลับลงสนามอีกไม่ได้ในเกมนั้น'
        ],
        [
          'When the ball goes out over the sideline, play restarts with a Throw-in, taken by the team that did not touch it last. The thrower must use both hands, throwing the ball from behind and over the head from the exact spot it left the field, keeping both feet on the ground outside the touchline.',
          "When the ball goes out over the goal line (behind the goal): if the attacking team touched it last, the defending team gets a Goal Kick (taken from inside their own goal area); if the defending team touched it last, the attacking team gets a Corner Kick (taken from the corner arc on the side the ball went out).",
          'A Free Kick comes in two types: a Direct Free Kick (which can be shot straight into the goal) is awarded for serious fouls like pushing or tripping; an Indirect Free Kick (which must touch another player before it can count as a goal) is awarded for lighter offenses, such as offside or a goalkeeper holding the ball too long.',
          "A Penalty Kick is awarded when the defending team commits a foul inside their own penalty area. It's taken from the penalty spot with only the goalkeeper to beat — the single highest-percentage scoring chance in the game.",
          'Substitutions: each team may make a limited number of substitutions per match (typically 3-5 depending on the competition). A player who has been substituted off cannot return to the field for the rest of that match.'
        ],
        svgFlowSteps([
          { title: 'Throw-in', sub: 'out on sideline', color: '#1971C2' },
          { title: 'Goal/Corner', sub: 'out on goal line', color: '#2F9E44' },
          { title: 'Free Kick', sub: 'foul committed', color: '#F5A524' },
          { title: 'Penalty', sub: 'foul in the box', color: '#E8590C' }
        ], 'football restart types flow diagram')),
      readingItem('กลยุทธ์เกมรับ: เพรสสูง (High Press) กับตั้งรับเป็นบล็อกต่ำ (Low Block)', 'Defensive Tactics: High Press vs Low Block',
        [
          'High Press (เพรสสูง): ทีมเข้าไปกดดันคู่แข่งตั้งแต่แดนของฝ่ายตรงข้าม พยายามแย่งบอลคืนให้เร็วที่สุดก่อนที่คู่แข่งจะตั้งเกมได้ ต้องใช้พลังงานสูงและวิ่งประกบกันเป็นทีม เหมาะกับทีมที่มีความฟิตดีและเล่นเป็นระบบ',
          'Low Block (บล็อกต่ำ): ทีมถอยร่นมายืนแน่นในแดนตัวเอง ปล่อยให้คู่แข่งครองบอลในแดนกลาง แต่บีบพื้นที่ให้แคบตรงหน้าประตูตัวเอง เน้นความแน่นหนาของแนวรับมากกว่าการวิ่งไล่บอล เหมาะกับทีมที่เจอคู่แข่งเก่งกว่าและเล่นเกมสวนกลับ (Counter-Attack)',
          'การเลือกใช้กลยุทธ์ขึ้นอยู่กับสถานการณ์: ทีมที่นำอยู่มักเลือก Low Block เพื่อรักษาผลไม่ให้คู่แข่งไล่ตีเสมอ ส่วนทีมที่ตามหลังหรือมีนักเตะฟิตกว่ามักเลือก High Press เพื่อสร้างโอกาสยิงประตูให้เร็วที่สุด',
          'แผนการเล่นแบบ 4-3-3 เน้นปีกกว้างสองข้างและกองกลาง 3 คน (มักมี 1 คนคอยตัดเกมรับ) เหมาะกับทีมที่เล่นบุกด้วยความเร็วทางริม — ส่วน 3-5-2 ใช้กองหลัง 3 คนกับวิงแบ็ก (Wing-back) วิ่งขึ้นลงข้างสนามแทนปีก ทำให้มีกำลังพลในแดนกลางเยอะกว่าแบบ 4-4-2'
        ],
        [
          'High Press: the team pressures the opponent starting from the opponent\'s own half, trying to win the ball back as quickly as possible before the opponent can build up play. It requires high fitness and coordinated team running — suited to teams with strong stamina and organized structure.',
          "Low Block: the team retreats to sit compactly in its own half, letting the opponent have the ball in midfield but squeezing the space right in front of its own goal. It prioritizes defensive solidity over chasing the ball — suited to teams facing a stronger opponent and relying on counter-attacks.",
          "Which tactic to use depends on the situation: a team that's ahead often chooses Low Block to protect the result, while a team that's behind or has fitter players often chooses High Press to create scoring chances as quickly as possible.",
          "The 4-3-3 formation emphasizes wide wingers and 3 midfielders (often with one dedicated to breaking up play) — suited to teams that attack with pace down the flanks. 3-5-2, meanwhile, uses 3 center-backs with wing-backs running up and down the sidelines instead of wingers, giving it more numbers in midfield than a 4-4-2."
        ],
        buildFootballPressingSvg()),
      readingItem('เทคนิคการโหม่งและการเข้าปะทะที่ถูกกติกา', 'Heading Technique & Legal Tackling',
        [
          'การโหม่งบอล (Heading): สัมผัสบอลด้วยหน้าผาก (ไม่ใช่กระหม่อมหรือท้ายทอย) เกร็งคอและกล้ามเนื้อคอ สะบัดคอไปข้างหน้าตอนบอลมาถึงเพื่อเพิ่มแรงส่ง ลืมตามองบอลตลอดจนกว่าจะสัมผัส ไม่ใช่หลับตาหลบบอล',
          'จังหวะกระโดดโหม่งที่ดีต้องอ่านวิถีบอลล่วงหน้า กระโดดขึ้นในจังหวะที่บอลอยู่สูงสุดของตัวเอง ไม่ใช่กระโดดตามบอลทีหลัง เพื่อให้ได้เปรียบเรื่องความสูงเหนือคู่แข่ง',
          'การเข้าปะทะแบบยืน (Standing Tackle) ปลอดภัยและควบคุมได้มากกว่า ใช้เท้าสอดเข้าแย่งบอลโดยไม่ล้มตัว ส่วนการเข้าสไลด์ (Sliding Tackle) มีความเสี่ยงสูงกว่า ต้องจับจังหวะให้แม่นและเล่นบอลก่อนขาคู่แข่งเสมอ ถ้าเข้าช้าเกินไปหรือพลาดไปโดนขาคู่ต่อสู้ก่อนจะถือเป็นฟาวล์ทันที',
          'การเข้าปะทะที่อันตราย (เช่น พุ่งเข้าใส่ด้วยปุ่มรองเท้าชี้ขึ้น หรือเข้าท้ายคู่แข่งโดยไม่เห็นบอล) มักได้ใบเหลืองหรือใบแดงทันที และถ้าเป็นการทำฟาวล์ผู้เล่นคนสุดท้ายที่ขวางกั้นโอกาสทำประตูชัดเจน (Denying an Obvious Goal-Scoring Opportunity) มักได้ใบแดงตรงแม้จะเป็นการปะทะที่ไม่รุนแรงมากก็ตาม'
        ],
        [
          "Heading: make contact with the ball using your forehead (not the crown or back of the head), tense your neck muscles, and snap your neck forward as the ball arrives to add power. Keep your eyes open and watch the ball all the way to contact — don't close your eyes and flinch away from it.",
          "Good header timing means reading the ball's flight in advance and jumping so you meet the ball at the top of your own jump, rather than jumping late and chasing it — this gives you a height advantage over the opponent.",
          "A Standing Tackle is safer and more controlled — using the foot to poke the ball away without going to ground. A Sliding Tackle carries more risk — timing must be precise, and the tackler must play the ball before the opponent's leg. Coming in too late, or making contact with the leg before the ball, is an immediate foul.",
          "Dangerous tackles (such as lunging in studs-up, or tackling from behind without seeing the ball) usually draw a yellow or straight red card. A foul that denies an obvious goal-scoring opportunity on the last defender often results in a straight red card even if the contact itself wasn't especially forceful."
        ],
        svgFactStrip([
          { title: 'Header', sub: 'forehead, eyes open', color: '#1971C2' },
          { title: 'Standing Tackle', sub: 'safer, controlled', color: '#2F9E44' },
          { title: 'Sliding Tackle', sub: 'ball first, risky', color: '#E8590C' }
        ], 'football heading and tackling technique facts'))
    ]
  },
  {
    id: 'basketball-basics',
    label: { th: 'บาสเกตบอล: กติกาพื้นฐาน', en: 'Basketball: Basic Rules' },
    group: { th: 'บาสเกตบอล', en: 'Basketball' },
    items: [
      readingItem('รู้จักบาสเกตบอล', 'Meet Basketball',
        [
          'บาสเกตบอล (Basketball) แข่งกันระหว่าง 2 ทีม ทีมละ 5 คนในสนาม เป้าหมายคือโยนบอลลงห่วง (Basket) ของฝ่ายตรงข้ามให้ได้คะแนนมากกว่า สนามมาตรฐานมีห่วงอยู่ปลายสนามทั้งสองฝั่ง',
          'การแข่งขันแบ่งเป็น 4 ควอเตอร์ (Quarter) ควอเตอร์ละ 10-12 นาทีแล้วแต่ลีก (เช่น NBA ใช้ 12 นาที, FIBA ใช้ 10 นาที) มีพักเบรกระหว่างควอเตอร์และพักครึ่งยาวกว่าหลังควอเตอร์ 2',
          'การให้คะแนน: ยิงจากในเส้นสามคะแนน (3-point line) ได้ 2 คะแนน, ยิงจากนอกเส้นสามคะแนนได้ 3 คะแนน, ยิงโทษ (Free Throw) ได้ 1 คะแนนต่อครั้ง'
        ],
        [
          "Basketball is played between 2 teams of 5 players each on the court. The goal is to shoot the ball into the opponent's basket (hoop) to score more points than them. A standard court has a hoop at each end.",
          'A match is divided into 4 quarters, each 10-12 minutes depending on the league (e.g. the NBA uses 12 minutes, FIBA uses 10 minutes), with short breaks between quarters and a longer halftime break after quarter 2.',
          'Scoring: a shot made from inside the 3-point line is worth 2 points, a shot from outside the 3-point line is worth 3 points, and a free throw is worth 1 point each.'
        ],
        svgFactStrip([
          { title: '5 v 5', sub: 'players per side', color: '#D9822B' },
          { title: '4 x 10-12 min', sub: 'quarters', color: '#D9822B' },
          { title: '2 / 3 / 1 pts', sub: 'shot values', color: '#E8590C' }
        ], 'basketball match facts diagram')),
      readingItem('การเลี้ยงบอลและการฟาวล์', 'Dribbling & Fouls',
        [
          "การเลี้ยงบอล (Dribbling): ผู้เล่นที่ถือบอลต้องเลี้ยงบอล (กระเด้งบอลกับพื้นต่อเนื่อง) ขณะเดินหรือวิ่ง ถ้าหยุดเลี้ยงแล้วเริ่มเลี้ยงใหม่ (Double Dribble) หรือเดินโดยไม่เลี้ยงบอล (Traveling) จะถูกเป่าฟาวล์ เสียสิทธิ์ครองบอลให้ฝ่ายตรงข้าม",
          "ผู้เล่นแต่ละคนมีโควตาฟาวล์ส่วนตัว (Personal Foul) ปกติ 5-6 ครั้งแล้วแต่ลีก ถ้าทำฟาวล์ครบโควตาจะถูก 'ไล่ออกจากเกม' (Fouled Out) ต้องออกจากสนามทันที",
          "24-Second Shot Clock (นาฬิกายิง 24 วินาที): ทีมที่ครองบอลต้องยิงให้บอลโดนห่วงภายใน 24 วินาที (บางลีกใช้ 30 หรือ 14 วินาทีในกรณีรีบาวด์ฝั่งรุก) ไม่งั้นเสียสิทธิ์ครองบอล"
        ],
        [
          'Dribbling: a player holding the ball must dribble (continuously bounce it on the floor) while walking or running. Stopping and re-starting a dribble (Double Dribble) or walking without dribbling (Traveling) is a violation, giving possession to the other team.',
          "Each player has a personal foul quota, usually 5-6 depending on the league. Reaching the foul limit means being 'fouled out' — the player must leave the game immediately.",
          'The 24-Second Shot Clock: the team in possession must get a shot to hit the rim within 24 seconds (some leagues use 30, or 14 after an offensive rebound), or they lose possession.'
        ],
        svgFactStrip([
          { title: '5-6 fouls', sub: 'personal foul limit', color: '#E8590C' },
          { title: '24 sec', sub: 'shot clock', color: '#D9822B' },
          { title: '🚫 Double Dribble', sub: 'lose possession', color: '#C92A2A' }
        ], 'basketball dribbling and foul rules diagram')),
      readingItem('5 ตำแหน่งผู้เล่นบาสเกตบอล', 'The 5 Basketball Positions',
        [
          'บาสเกตบอลมีตำแหน่งหลัก 5 ตำแหน่ง: การ์ดจ่าย (Point Guard, PG) ผู้นำเกมรุกและจ่ายบอล, การ์ดยิง (Shooting Guard, SG) ทำหน้าที่ยิงระยะไกล, สมอลฟอร์เวิร์ด (Small Forward, SF) เล่นได้รอบด้านทั้งยิงและตัดเข้าห่วง',
          'เพาเวอร์ฟอร์เวิร์ด (Power Forward, PF) เล่นใกล้ห่วง แข็งแกร่งทั้งรุกและรับ — เซ็นเตอร์ (Center, C) มักเป็นผู้เล่นตัวสูงที่สุดในทีม ยืนใกล้ห่วงที่สุด ทำหน้าที่รีบาวด์และบล็อก',
          'ดูไดอะแกรมด้านล่าง: ตำแหน่งเรียงจากใกล้ห่วง (C ด้านบน) ไปจนถึงตำแหน่งไกลห่วงที่สุด (PG ด้านล่าง) — ทีมจริงปรับตำแหน่งได้ยืดหยุ่นตามสไตล์การเล่น'
        ],
        [
          'Basketball has 5 main positions: the Point Guard (PG) leads the offense and distributes the ball; the Shooting Guard (SG) specializes in long-range shooting; the Small Forward (SF) is versatile, both shooting and driving to the basket.',
          'The Power Forward (PF) plays close to the basket, strong on both offense and defense — the Center (C) is usually the tallest player on the team, positioned closest to the basket, responsible for rebounds and blocks.',
          'See the diagram below: positions run from closest to the basket (C at the top) to farthest (PG at the bottom) — real teams adjust positioning flexibly depending on their playing style.'
        ],
        buildBasketballPositionsSvg()),
      readingItem('มุมยิงที่ถูกต้อง (Shooting Arc)', 'The Ideal Shooting Arc',
        [
          "การยิงบาสเกตบอลที่ดีต้องมี 'ส่วนโค้ง' (Arc) ของลูกบอลที่เหมาะสม ไม่ใช่ยิงเส้นตรงแบนราบ — มุมยิงที่แนะนำอยู่ที่ประมาณ 45-52 องศาเมื่อวัดจากพื้น",
          "ประโยชน์ของมุมยิงสูง: ลูกบอลจะพุ่งลงห่วงในแนวดิ่งมากขึ้น ทำให้ 'ช่องรับบอล' ที่ปากห่วงกว้างขึ้นเมื่อเทียบกับยิงเส้นตรง เพิ่มโอกาสเข้าห่วง",
          'เทคนิคช่วยจำท่ายิงพื้นฐานเรียกว่า BEEF: Balance (ทรงตัวมั่นคง) Eyes (มองเป้าหมาย/ห่วง) Elbow (ศอกอยู่ใต้บอลตรงแนวห่วง) Follow-through (สะบัดข้อมือตามหลังปล่อยบอล)'
        ],
        [
          "A good basketball shot needs the right 'arc' — not a flat, straight-line shot. The recommended shooting angle is roughly 45-52 degrees from the ground.",
          "The benefit of a higher arc: the ball comes down into the hoop more vertically, giving it a wider 'window' to fall through compared to a flatter shot — increasing the chance of scoring.",
          'A common memory trick for shooting form is BEEF: Balance (stable stance), Eyes (focus on the target/rim), Elbow (kept under the ball, in line with the basket), Follow-through (snap the wrist after releasing).'
        ],
        buildBasketballShotArcSvg()),
      readingItem('การละเมิดกติกาและสถานการณ์พิเศษ', 'Violations & Special Situations',
        [
          'Backcourt Violation: เมื่อทีมได้บอลในแดนหน้า (แดนรุก) แล้ว ห้ามพาบอลกลับไปแตะแดนหลัง (แดนตัวเอง) อีก ถ้าทำจะเสียสิทธิ์ครองบอลให้ฝ่ายตรงข้ามทันที',
          '3-Second Violation: ผู้เล่นฝ่ายรุกห้ามยืนอยู่ในเขตใต้ห่วง (The Key/Paint) นานเกิน 3 วินาทีติดต่อกันขณะทีมตัวเองครองบอล เพื่อป้องกันการยืนกีดขวางใกล้ห่วงตลอดเวลา',
          'Goaltending: ห้ามผู้เล่นฝ่ายรับสัมผัสบอลขณะที่บอลกำลังพุ่งลงในวิถีขาลงเหนือห่วง (ถือว่าบอลจะเข้าอยู่แล้ว) ถ้าทำจะถูกนับเป็นประตูให้ฝ่ายรุกทันที',
          "ฟาวล์เชิงเทคนิค (Technical Foul) ให้สำหรับพฤติกรรมไม่เหมาะสม เช่น โต้เถียงกรรมการรุนแรงหรือทำผิดมารยาท ทีมตรงข้ามได้ยิงโทษฟรีโดยไม่เสียสิทธิ์ครองบอล — ต่างจากฟาวล์ส่วนตัวปกติที่มาจากการปะทะร่างกาย",
          "Bonus Free Throws: เมื่อทีมทำฟาวล์ทีมสะสมครบโควตาในควอเตอร์นั้น (ปกติ 5 ครั้ง) ทุกฟาวล์ต่อจากนั้นของทีมนั้น ฝ่ายตรงข้ามจะได้ยิงโทษแม้ฟาวล์นั้นไม่ได้เกิดขณะยิงบอล เรียกว่าสถานะ 'Bonus'",
          'ถ้าคะแนนเสมอกันเมื่อจบควอเตอร์ 4 จะมีการต่อเวลาพิเศษ (Overtime) ครั้งละ 5 นาที เล่นต่อไปเรื่อยๆ จนกว่าจะมีทีมที่คะแนนนำเมื่อหมดเวลา'
        ],
        [
          'Backcourt Violation: once a team brings the ball into the frontcourt (attacking half), it may not carry or pass the ball back across the mid-court line into its own backcourt — doing so gives possession to the other team immediately.',
          '3-Second Violation: an offensive player may not stand inside the key (the paint, under the basket) for more than 3 consecutive seconds while their team has possession — this prevents players from camping right next to the hoop.',
          "Goaltending: a defender may not touch the ball while it's on its downward path above the rim and appears to be going in — doing so awards the basket to the offense automatically.",
          'A Technical Foul is given for unsportsmanlike conduct, such as arguing aggressively with a referee. The opposing team is awarded free throws without losing possession — unlike a regular personal foul, which comes from physical contact.',
          "Bonus Free Throws: once a team's fouls in a quarter reach the team-foul limit (usually 5), every additional foul by that team sends the opponent to the free-throw line, even if the foul didn't happen during a shot — this is called being 'in the bonus'.",
          'If the score is tied at the end of the 4th quarter, the game goes to Overtime — extra 5-minute periods played one after another until one team is ahead when time runs out.'
        ],
        svgFactStrip([
          { title: '3 sec', sub: 'max time in the key', color: '#D9822B' },
          { title: 'Goaltending', sub: 'ball on downward path', color: '#E8590C' },
          { title: '+5 min', sub: 'overtime period', color: '#1971C2' }
        ], 'basketball violations and overtime rules diagram')),
      readingItem('กลยุทธ์เกมรับ: Man-to-Man กับ Zone Defense', 'Defensive Tactics: Man-to-Man vs Zone Defense',
        [
          'Man-to-Man Defense (ประกบตัวต่อตัว): ผู้เล่นแต่ละคนรับผิดชอบประกบคู่แข่งคนใดคนหนึ่งตลอดเกม ไม่ว่าคู่แข่งจะเคลื่อนที่ไปไหนในสนาม ข้อดีคือกดดันได้ตรงจุดและปรับตัวไล่ตามผู้เล่นเก่งของคู่แข่งได้ง่าย แต่เสี่ยงถ้าผู้เล่นวิ่งไม่ทันหรือโดนสกรีน (Screen) บล็อกทาง',
          'Zone Defense (เกมรับแบบโซน): ผู้เล่นแต่ละคนรับผิดชอบพื้นที่ที่กำหนดไว้แทนที่จะประกบคนใดคนหนึ่ง เช่นรูปแบบ 2-3 Zone (แนวหน้า 2 คนใกล้เส้นสามคะแนน แนวหลัง 3 คนใกล้ห่วง) ดูไดอะแกรมด้านล่างประกอบ ข้อดีคือป้องกันการตัดเข้าใต้ห่วงได้ดีและประหยัดพลังงานกว่า แต่มีช่องโหว่บริเวณมุมสนามที่ไม่มีใครรับผิดชอบชัดเจน',
          'ทีมมักสลับใช้ทั้งสองระบบในเกมเดียวกันเพื่อให้คู่แข่งปรับตัวไม่ทัน — เปลี่ยนจาก Man-to-Man เป็น Zone กะทันหันหลังทำแต้มได้ เป็นกลยุทธ์ที่พบบ่อยในระดับสูง'
        ],
        [
          "Man-to-Man Defense: each player is responsible for guarding one specific opponent throughout the game, wherever that opponent moves on the court. Its advantage is targeted pressure and the ability to shut down the opponent's best player — but it's vulnerable if a defender gets beaten for speed or blocked out by a screen.",
          "Zone Defense: each player is responsible for a fixed area of the court rather than a specific opponent — for example, the 2-3 Zone (2 defenders up near the 3-point line, 3 defenders back near the basket, see the diagram below). Its advantage is stronger protection against drives to the basket and lower energy cost, but it leaves gaps in the corners that aren't clearly anyone's responsibility.",
          "Teams often switch between both systems within the same game to keep the opponent from adjusting — suddenly switching from man-to-man to zone right after scoring is a common tactic at higher levels."
        ],
        buildBasketballZoneDefenseSvg()),
      readingItem('การรีบาวด์และการเล่น Pick and Roll', 'Rebounding & the Pick and Roll',
        [
          'การรีบาวด์ (Rebound) คือการเก็บบอลที่กระดอนออกจากห่วงหรือกระดานหลังยิงไม่เข้า แบ่งเป็น Offensive Rebound (ทีมรุกเก็บเองแล้วยิงซ้ำ) และ Defensive Rebound (ทีมรับเก็บเพื่อตัดจบการครองบอลของฝ่ายรุก)',
          'เทคนิคสำคัญของการรีบาวด์คือ Boxing Out — หันหลังกันคู่แข่งไม่ให้เข้าใกล้ห่วงก่อนบอลจะตกลงมา ยืนกางแขนกว้างและงอเข่าต่ำเพื่อทรงตัวมั่นคง แล้วค่อยกระโดดเก็บบอลเมื่อบอลตกลงมาถึง',
          'Pick and Roll (บอลคู่ตั้งการ์ด-โรล) เป็นแท็กติกพื้นฐานที่นิยมที่สุดในบาสเกตบอลสมัยใหม่: ผู้เล่นคนหนึ่ง (Screener) ยืนขวางทางผู้ประกบเพื่อนร่วมทีมที่ถือบอล (Ball Handler) เปิดทางให้เพื่อนขับเข้าไปทำเกม จากนั้น Screener จะหมุนตัว (Roll) เข้าหาห่วงเพื่อรับบอลต่อในจังหวะที่แนวรับสับสน',
          'ฝ่ายรับมีวิธีรับมือ Pick and Roll หลายแบบ เช่น Switch (สลับคู่ประกบกันเลยตอนโดนสกรีน) หรือ Hedge/Show (ผู้เล่นที่ประกบ Screener ออกมาช่วยดักผู้ถือบอลชั่วคราวก่อนกลับไปหาคู่ของตัวเอง)'
        ],
        [
          "A Rebound is recovering the ball after a missed shot bounces off the rim or backboard. There are two kinds: an Offensive Rebound (the attacking team recovers it and can shoot again) and a Defensive Rebound (the defending team recovers it to end the offense's possession).",
          "The key rebounding technique is Boxing Out — turning your back to the opponent to keep them away from the basket before the ball comes down, spreading your arms wide and bending your knees low for a stable base, then jumping to grab the ball once it arrives.",
          "The Pick and Roll is the single most common tactic in modern basketball: one player (the Screener) stands in the way of the defender guarding a teammate who has the ball (the Ball Handler), opening a lane for that teammate to drive. The Screener then 'rolls' toward the basket to receive a pass while the defense is scrambled.",
          "Defenses handle the Pick and Roll several ways — for example, Switching (the two defenders simply swap assignments when the screen happens) or Hedging/Showing (the defender guarding the screener briefly steps out to slow the ball handler before recovering back to their own man)."
        ],
        svgFlowSteps([
          { title: 'Screen', sub: 'block defender', color: '#1971C2' },
          { title: 'Drive', sub: 'ball handler attacks', color: '#2F9E44' },
          { title: 'Roll', sub: 'screener cuts to hoop', color: '#E8590C' }
        ], 'basketball pick and roll sequence diagram'))
    ]
  },
  {
    id: 'volleyball-basics',
    label: { th: 'วอลเลย์บอล: กติกาพื้นฐาน', en: 'Volleyball: Basic Rules' },
    group: { th: 'วอลเลย์บอล', en: 'Volleyball' },
    items: [
      readingItem('รู้จักวอลเลย์บอล', 'Meet Volleyball',
        [
          'วอลเลย์บอล (Volleyball) แข่งกันระหว่าง 2 ทีม ทีมละ 6 คนในสนาม แบ่งฝั่งด้วยตาข่ายตรงกลาง เป้าหมายคือตีลูกบอลข้ามตาข่ายให้ตกพื้นฝั่งคู่แข่ง หรือทำให้คู่แข่งเล่นลูกผิดพลาด',
          'แต่ละทีมสัมผัสบอลได้สูงสุด 3 ครั้งต่อฝั่ง (ไม่นับบล็อก) ก่อนต้องส่งบอลข้ามตาข่าย ผู้เล่นคนเดียวห้ามสัมผัสบอล 2 ครั้งติดกัน (ยกเว้นบล็อก)',
          'การแข่งขันเล่นแบบ Best of 5 เซต (ชนะ 3 ใน 5 เซต) แต่ละเซตเล่นถึง 25 แต้ม (เซตตัดสินที่ 5 เล่นถึง 15 แต้ม) ต้องนำอย่างน้อย 2 แต้มถึงจะชนะเซต'
        ],
        [
          "Volleyball is played between 2 teams of 6 players each on the court, divided by a net in the middle. The goal is to hit the ball over the net so it lands on the opponent's side, or to force the opponent into a mistake.",
          'Each team may touch the ball up to 3 times per side (not counting a block) before it must cross the net. No single player may touch the ball twice in a row (except for a block).',
          'A match is played best-of-5 sets (first to win 3 sets). Each set is played to 25 points (the deciding 5th set is played to 15), and a team must win by at least 2 points to take the set.'
        ],
        svgFactStrip([
          { title: '6 v 6', sub: 'players per side', color: '#2B6CB0' },
          { title: '3 touches', sub: 'max per side', color: '#2B6CB0' },
          { title: 'Best of 5', sub: 'sets, to 25 pts', color: '#1971C2' }
        ], 'volleyball match facts diagram')),
      readingItem('การเสิร์ฟ บล็อก และตำแหน่งหมุนเวียน', 'Serving, Blocking & Rotation',
        [
          'การเสิร์ฟ (Serve): ผู้เล่นเสิร์ฟยืนหลังเส้นท้ายสนามแล้วตีบอลข้ามตาข่ายเข้าไปในสนามคู่แข่ง เป็นการเริ่มต้นทุกแต้ม ถ้าเสิร์ฟบอลออกหรือติดตาข่าย ฝ่ายตรงข้ามได้แต้มทันที',
          'การบล็อก (Block): ผู้เล่นแถวหน้าสามารถกระโดดยื่นมือข้ามตาข่ายเพื่อสกัดบอลที่คู่แข่งตีมา บล็อกไม่นับเป็น 1 ใน 3 ครั้งสัมผัสบอลของทีม',
          'การหมุนตำแหน่ง (Rotation): ทุกครั้งที่ทีมได้สิทธิ์เสิร์ฟใหม่ (จากการเสียแต้มของฝ่ายตรงข้าม) ผู้เล่นทั้ง 6 คนต้องหมุนตำแหน่งตามเข็มนาฬิกา 1 ตำแหน่ง เพื่อให้ทุกคนได้เสิร์ฟและเล่นครบทุกตำแหน่งสลับกันไป'
        ],
        [
          "The Serve: the serving player stands behind the back line and hits the ball over the net into the opponent's court. It starts every point — if the serve goes out of bounds or hits the net without crossing, the other team scores immediately.",
          "The Block: front-row players may jump and reach over the net to intercept the opponent's attack. A block does not count as one of the team's 3 allowed touches.",
          "Rotation: every time a team regains the right to serve (after winning a point off the opponent's serve), all 6 players rotate one position clockwise, so everyone takes turns serving and playing every position."
        ],
        svgFactStrip([
          { title: 'Serve', sub: 'starts every point', color: '#1971C2' },
          { title: 'Block', sub: 'not a counted touch', color: '#2F9E44' },
          { title: 'Rotate', sub: 'clockwise on serve win', color: '#E8590C' }
        ], 'volleyball serving blocking and rotation facts diagram')),
      readingItem('6 โซนตำแหน่งและการหมุนตำแหน่ง', 'The 6 Court Zones & Rotation',
        [
          'สนามฝั่งหนึ่งแบ่งเป็น 6 โซน มีเลขกำกับ 1-6 — แถวหน้า (ใกล้ตาข่าย) คือโซน 4, 3, 2 (ซ้ายไปขวา) แถวหลัง (ใกล้เส้นหลัง) คือโซน 5, 6, 1 (ซ้ายไปขวา)',
          'โซน 1 คือตำแหน่งเสิร์ฟ เมื่อทีมหมุนตำแหน่งตามเข็มนาฬิกา ผู้เล่นที่อยู่โซน 1 เดิมจะย้ายไปโซน 6 ผู้เล่นโซน 6 ย้ายไปโซน 5 และวนต่อไปเรื่อยๆ จนครบ',
          "ผู้เล่นแถวหลัง (โซน 1, 5, 6) มีข้อจำกัด: ห้ามกระโดดตบบอลจากหน้าเส้น 3 เมตร (Attack Line) และห้ามบล็อกที่ตาข่าย — กติกานี้ทำให้ 'Libero' (ผู้เล่นตำแหน่งรับเฉพาะทาง) เป็นที่นิยมในทีมระดับสูง"
        ],
        [
          'One side of the court is divided into 6 numbered zones — the front row (near the net) is Zones 4, 3, 2 (left to right); the back row (near the baseline) is Zones 5, 6, 1 (left to right).',
          'Zone 1 is the serving position. When a team rotates clockwise, the player in Zone 1 moves to Zone 6, the player in Zone 6 moves to Zone 5, and so on around the cycle.',
          "Back-row players (Zones 1, 5, 6) have restrictions: they may not jump and attack from in front of the 3-meter attack line, and may not block at the net — this rule is why the 'Libero' (a specialist defensive position) is popular at higher levels."
        ],
        buildVolleyballPositionsSvg()),
      readingItem('เทคนิคการรับลูกด้วยแขน (Forearm Pass)', 'Forearm Pass Technique',
        [
          'การรับลูกด้วยแขน (Forearm Pass หรือ Bump) เป็นทักษะแรกที่นักตบมือใหม่ต้องฝึก ใช้รับลูกเสิร์ฟหรือลูกตบจากฝ่ายตรงข้าม',
          "ท่าที่ถูกต้อง: ประกบมือทั้งสองข้างเข้าด้วยกันให้เป็น 'แพลตฟอร์ม' เรียบ เหยียดแขนตรง งอเข่าย่อตัวต่ำ แล้วใช้แรงจากขาดันตัวขึ้นไปสัมผัสบอล ไม่ใช่แกว่งแขนตี",
          'มุมของแพลตฟอร์มแขนกำหนดทิศทางที่บอลจะพุ่งไป — เอียงแขนไปทางตัวตั้งบอล (โซน 2-3) เพื่อส่งบอลให้ตัวตั้งเตรียมเซ็ตต่อ ดูไดอะแกรมด้านล่างประกอบ'
        ],
        [
          "The Forearm Pass (or 'Bump') is the first skill every beginner volleyball player must learn — used to receive serves or attacks from the opposing team.",
          'Correct form: press both hands together to form a flat \'platform\', keep the arms straight, bend the knees into a low stance, and use leg power to push up into the ball — not a swinging arm motion.',
          'The angle of the arm platform determines where the ball goes — angle the arms toward the setter (Zones 2-3) to direct the ball for the next set. See the diagram below.'
        ],
        buildVolleyballPassSvg()),
      readingItem('การละเมิดกติกาที่พบบ่อยและประเภทการเสิร์ฟ', 'Common Faults & Serve Types',
        [
          'Four Hits: ถ้าทีมสัมผัสบอลเกิน 3 ครั้ง (ไม่นับบล็อก) ก่อนส่งข้ามตาข่าย ถือเป็นการทำผิดกติกา เสียแต้มให้ฝ่ายตรงข้ามทันที',
          'Double Touch: ผู้เล่นคนเดียวสัมผัสบอล 2 ครั้งติดต่อกัน (ยกเว้นตอนบล็อก หรือกรณีสัมผัสครั้งแรกของทีมที่กระเด้งหลายจุดในจังหวะเดียว) ถือเป็นการทำผิดกติกาเช่นกัน',
          "Carrying/Lifting: การสัมผัสบอลด้วยท่าทางที่ดูเหมือน 'จับ' หรือ 'โยน' บอลแทนที่จะเป็นการตี/สัมผัสสั้นๆ (มักเกิดตอนเซ็ต) ถือเป็นการทำผิดกติกา",
          'Net Touch: ผู้เล่นห้ามสัมผัสตาข่ายขณะเล่นลูก (ยกเว้นกรณีสัมผัสเบามากที่ไม่มีผลต่อการเล่น) และห้ามล้ำเส้นกลางสนามเข้าไปในแดนคู่แข่งขณะบอลยังอยู่ในการเล่น',
          'ประเภทการเสิร์ฟหลัก: Float Serve (เสิร์ฟลอย ไม่หมุน ทำให้บอลเคลื่อนที่ไม่แน่นอนคาดเดายาก) และ Jump Serve (เสิร์ฟกระโดด ตีแรงและเร็วเหมือนลูกตบ นิยมในระดับสูง เพราะสร้างแรงกดดันให้ฝ่ายรับได้มาก)'
        ],
        [
          'Four Hits: if a team touches the ball more than 3 times (not counting a block) before sending it over the net, that\'s a fault and the point goes to the other team immediately.',
          'Double Touch: a single player touching the ball twice in a row (except while blocking, or during a legal multi-contact first touch) is also a fault.',
          "Carrying/Lifting: contacting the ball in a way that looks like 'catching' or 'throwing' it rather than a clean, brief touch or strike — this most often happens during a set — is a fault.",
          "Net Touch: players may not touch the net while playing the ball (a very light, incidental touch that doesn't affect play is usually allowed), and may not cross under the net into the opponent's side while the ball is in play.",
          'Two main serve types: the Float Serve (a serve with no spin, making the ball\'s flight unpredictable and hard to read) and the Jump Serve (a jumping serve struck hard and fast like an attack, popular at higher levels because it puts heavy pressure on the receiving team).'
        ],
        svgFactStrip([
          { title: '🚫 4 Hits', sub: 'over 3 touches', color: '#E8590C' },
          { title: '🚫 Double Touch', sub: 'same player x2', color: '#E8590C' },
          { title: 'Float / Jump', sub: '2 serve types', color: '#1971C2' }
        ], 'volleyball common faults and serve types diagram')),
      readingItem('เทคนิคการตบบอล (Spike/Attack) และการเซ็ต', 'Spike/Attack Technique & Setting',
        [
          'การเข้าตบบอล (Approach) แบบมาตรฐานมี 3-4 ก้าว: ก้าวแรกสั้นๆ กำหนดจังหวะ ก้าวที่สองยาวขึ้นเพื่อสร้างความเร็ว ก้าวสุดท้ายเป็นการทิ้งเท้าลงพร้อมกัน (ปกติเท้าซ้ายแล้วขวาสำหรับคนถนัดขวา) เพื่อเบรกความเร็วในแนวนอนเป็นแรงกระโดดในแนวตั้ง ดูไดอะแกรมด้านล่างประกอบ',
          'ขณะกระโดดให้แขนทั้งสองข้างแกว่งจากด้านหลังไปด้านหน้าช่วยส่งแรงกระโดดขึ้น แขนที่ตีบอล (Hitting Arm) ยกขึ้นเตรียมพร้อม แล้วเหวี่ยงตีบอลด้วยจังหวะสะบัดข้อมือตอนแขนเหยียดตรงที่สุด เพื่อให้บอลพุ่งลงแรงและควบคุมทิศทางได้',
          'การเซ็ต (Set) คือการส่งบอลให้ตัวตบในตำแหน่งและความสูงที่พอดี ผู้เซ็ตใช้ปลายนิ้วทั้งสองมือดันบอลขึ้นเบาๆ เหนือหน้าผาก ต้องตัดสินใจเร็วว่าจะเซ็ตให้ตัวตบคนไหน (เร็วหรือช้า สูงหรือเตี้ย) เพื่อหลอกแนวรับฝ่ายตรงข้าม'
        ],
        [
          'A standard attack approach uses 3-4 steps: a short first step to set the rhythm, a longer second step to build speed, and a final two-footed plant (typically left-then-right for a right-handed hitter) that converts horizontal speed into vertical jump power. See the diagram below.',
          'While jumping, both arms swing from back to front to help drive the jump upward. The hitting arm is drawn back ready to strike, then swings through and snaps at the wrist at full extension, so the ball is hit down hard with controlled direction.',
          'Setting is delivering the ball to a hitter at just the right position and height. The setter uses both hands\' fingertips to gently push the ball upward from just above the forehead, and must decide quickly which hitter to set to (fast or slow, high or low) to keep the opposing defense guessing.'
        ],
        buildVolleyballSpikeApproachSvg()),
      readingItem('ระบบการเล่น 5-1 / 6-2 และตำแหน่ง Libero', '5-1 / 6-2 Systems & the Libero Position',
        [
          'ระบบ 5-1 คือทีมมีตัวเซ็ต (Setter) เพียง 1 คนที่เซ็ตบอลตลอดเกมไม่ว่าจะหมุนไปอยู่ตำแหน่งไหน ส่วนอีก 5 คนเป็นตัวตบ/บล็อก — เป็นระบบยอดนิยมในระดับสูงเพราะเซ็ตเตอร์คนเดียวจะคุ้นเคยกับตัวตบทุกคนอย่างต่อเนื่อง',
          'ระบบ 6-2 คือทีมมีตัวเซ็ตสำรอง 2 คน สลับกันเป็นตัวตบเวลาอยู่แถวหน้าและเป็นตัวเซ็ตเวลาอยู่แถวหลัง ทำให้ทีมมีตัวตบแถวหน้าครบ 3 คนตลอดเวลา (แทนที่จะเหลือแค่ 2 คนแบบระบบ 5-1) แต่ต้องใช้ผู้เล่นที่เซ็ตเก่งถึง 2 คน',
          'Libero คือตำแหน่งผู้เล่นรับเฉพาะทาง สวมเสื้อสีต่างจากเพื่อนร่วมทีมให้กรรมการสังเกตง่าย เปลี่ยนตัวเข้า-ออกได้ไม่จำกัดจำนวนครั้ง (แต่ต้องสลับกับผู้เล่นแถวหลังคนเดิมเท่านั้น) และห้ามตบบอลข้ามตาข่ายขณะบอลอยู่สูงกว่าระดับตาข่ายทั้งลูก',
          'Libero ห้ามเสิร์ฟในกติกาเดิม แต่ในกติกาปัจจุบันหลายรายการแข่งขันอนุญาตให้ Libero เสิร์ฟแทนผู้เล่นตำแหน่งหนึ่งได้ (ตรวจสอบกติกาเฉพาะของแต่ละรายการแข่งขัน) — จุดเด่นของ Libero คือทักษะรับลูกและเซฟบอลที่ยอดเยี่ยม ทำให้ทีมลดความเสี่ยงเสียแต้มจากการรับเสิร์ฟหรือรับลูกตบพลาด'
        ],
        [
          'The 5-1 system has just one Setter who sets the ball all game long no matter which position they rotate into, with the other 5 players as hitters/blockers — this is the most popular system at higher levels because a single setter builds consistent chemistry with every hitter.',
          'The 6-2 system uses two setters who alternate: hitting while in the front row and setting while in the back row. This keeps the team with a full 3 front-row hitters at all times (instead of only 2 under a 5-1 system) — but it requires two players who are both strong setters.',
          'The Libero is a specialist defensive position, wearing a different-colored jersey so referees can spot them easily. They can substitute in and out an unlimited number of times (but only ever swapping with the same back-row player) and may not attack the ball above net height.',
          'Traditionally the Libero was not allowed to serve, but many current competitions now allow the Libero to serve in place of one rotation position (check the specific rules of each competition). The Libero\'s strength is elite passing and defensive skill, which reduces a team\'s risk of losing points on serve-receive or dig errors.'
        ],
        svgFactStrip([
          { title: '5-1', sub: 'one setter', color: '#1971C2' },
          { title: '6-2', sub: 'two setters', color: '#2F9E44' },
          { title: 'Libero', sub: 'defense specialist', color: '#E8590C' }
        ], 'volleyball 5-1 6-2 systems and libero position diagram'))
    ]
  },
  {
    id: 'badminton-basics',
    label: { th: 'แบดมินตัน: กติกาพื้นฐาน', en: 'Badminton: Basic Rules' },
    group: { th: 'แบดมินตัน', en: 'Badminton' },
    items: [
      readingItem('รู้จักแบดมินตัน', 'Meet Badminton',
        [
          'แบดมินตัน (Badminton) เล่นได้ทั้งประเภทเดี่ยว (Singles, 1 ต่อ 1) และประเภทคู่ (Doubles, 2 ต่อ 2) ตีลูกขนไก่ (Shuttlecock) ข้ามตาข่ายให้ตกในเขตสนามของฝ่ายตรงข้าม โดยไม่ให้ลูกโดนพื้นฝั่งตัวเอง',
          'การแข่งขันเล่นแบบ Best of 3 เกม (ชนะ 2 ใน 3 เกม) แต่ละเกมเล่นถึง 21 แต้ม ต้องนำอย่างน้อย 2 แต้มถึงจะชนะเกม (ถ้าเสมอ 20-20 ต้องนำห่าง 2 แต้ม สูงสุดไม่เกิน 30 แต้ม ถ้าถึง 29-29 ใครถึง 30 ก่อนชนะทันที)',
          "ระบบคะแนนปัจจุบันคือ 'Rally Point System' — ได้แต้มทุกครั้งที่ชนะแรลลี่นั้น ไม่ว่าฝ่ายไหนเป็นฝ่ายเสิร์ฟ (ต่างจากระบบเก่าที่ต้องเป็นฝ่ายเสิร์ฟถึงจะได้แต้ม)"
        ],
        [
          "Badminton can be played Singles (1 vs 1) or Doubles (2 vs 2). Players hit a shuttlecock over the net so it lands inside the opponent's court, while keeping it from hitting the floor on their own side.",
          'A match is best-of-3 games (first to win 2). Each game is played to 21 points, won by a margin of at least 2 points (if tied 20-20, a team must lead by 2, up to a hard cap of 30 — first to 30 at 29-29 wins outright).',
          "The scoring system is the 'Rally Point System' — a point is scored on every rally regardless of who served (unlike the old system, where only the serving side could score)."
        ],
        svgFactStrip([
          { title: '1v1 / 2v2', sub: 'singles or doubles', color: '#2F9E44' },
          { title: '21 pts', sub: 'per game, win by 2', color: '#2F9E44' },
          { title: 'Rally Point', sub: 'score every rally', color: '#1971C2' }
        ], 'badminton match facts diagram')),
      readingItem('การเสิร์ฟและข้อผิดพลาดที่พบบ่อย', 'Serving & Common Faults',
        [
          "การเสิร์ฟ (Serve) ต้องตีลูกจากใต้เอวขึ้นไป (Underarm) เท่านั้น ห้ามตีลูกในระดับสูงกว่านั้น และหัวไม้ต้องชี้ต่ำกว่ามือที่จับด้ามขณะตี ถ้าผิดกติกาถือเป็น 'Service Fault' เสียแต้มทันที",
          'ในประเภทคู่ ผู้เล่นเสิร์ฟและรับเสิร์ฟต้องยืนในช่องสนามที่ถูกต้องตามคะแนนคู่/คี่ของทีมตัวเอง (แต้มคู่เสิร์ฟจากช่องขวา แต้มคี่เสิร์ฟจากช่องซ้าย)',
          "ลูกที่ถือว่า 'ออก' (Out) คือลูกตกนอกเส้นสนาม หรือลูกที่ผู้เล่นตีไม่ข้ามตาข่าย หรือลูกที่โดนตัวผู้เล่นก่อนตกพื้น — ทุกกรณีทำให้อีกฝ่ายได้แต้มทันทีตาม Rally Point System"
        ],
        [
          "The serve must be hit underarm (from below the waist) only — hitting the shuttlecock at a higher point is not allowed, and the racket head must point below the serving hand while striking. Breaking this rule is a 'Service Fault' and costs the point immediately.",
          "In doubles, the server and receiver must stand in the correct service court based on their team's score being even or odd (an even score serves from the right court, an odd score serves from the left).",
          "A shuttlecock is called 'out' if it lands outside the court lines, if a player fails to hit it over the net, or if it touches a player's body before hitting the ground — in every case, the other side scores the point immediately under the Rally Point System."
        ],
        svgFactStrip([
          { title: 'Underarm', sub: 'below the waist', color: '#1971C2' },
          { title: '🚫 Service Fault', sub: 'lose point instantly', color: '#E8590C' },
          { title: 'Even→R / Odd→L', sub: 'doubles courts', color: '#2F9E44' }
        ], 'badminton serving and common fault facts diagram')),
      readingItem('เส้นสนามเดี่ยว vs เส้นสนามคู่', 'Singles vs Doubles Court Lines',
        [
          'สนามแบดมินตันมีเส้นสองชุดซ้อนกัน: เส้นสนามเดี่ยว (Singles) แคบกว่าแต่ลึกกว่า และเส้นสนามคู่ (Doubles) กว้างกว่าแต่ตื้นกว่า — ผู้เล่นต้องรู้ว่าเส้นไหนใช้กับประเภทที่ตัวเองเล่นอยู่',
          'เส้นข้างสนามเดี่ยว (สีส้มในไดอะแกรม) อยู่ด้านในกว่าเส้นข้างสนามคู่ (สีน้ำเงิน) เพราะสนามเดี่ยวไม่ต้องกว้างเท่าสนามคู่ (มีผู้เล่นแค่ฝั่งละคน)',
          'ในทางกลับกัน เส้นหลังสำหรับการเสิร์ฟคู่ (Doubles Long Service Line) อยู่ในกว่าเส้นหลังสุดของสนาม (ซึ่งเป็นเส้นหลังสำหรับสนามเดี่ยวด้วย) เพราะการเสิร์ฟคู่มักตีลูกสั้นกว่าเพื่อไม่ให้คู่ต่อสู้โต้กลับง่าย'
        ],
        [
          "A badminton court has two overlapping sets of lines: the Singles lines (narrower but deeper) and the Doubles lines (wider but shallower) — players need to know which lines apply to the format they're playing.",
          'The singles sideline (orange in the diagram) sits inside the doubles sideline (blue), because a singles court doesn\'t need to be as wide (only one player per side).',
          'Conversely, the doubles long service line sits inside the very back boundary (which also serves as the singles long service line/back boundary), because doubles serves are usually kept shorter so the opponent can\'t easily attack them.'
        ],
        buildBadmintonCourtSvg()),
      readingItem('3 ประเภทลูกตีพื้นฐาน: Clear, Drop, Smash', '3 Basic Shot Types: Clear, Drop, Smash',
        [
          'Clear (ลูกโด่งลึก): ตีลูกให้พุ่งสูงและลึกไปตกด้านหลังสนามคู่แข่ง ใช้ดันคู่แข่งให้ถอยไปแดนหลัง ซื้อเวลาตั้งท่าใหม่',
          'Drop (ลูกหยอด): ตีลูกให้ข้ามตาข่ายแบบนุ่มๆ ตกใกล้ตาข่ายฝั่งคู่แข่ง ใช้หลอกล่อให้คู่แข่งวิ่งเข้ามาใกล้ตาข่าย',
          'Smash (ลูกตบ): ตีลูกลงแรงและเร็วในมุมชัน เป็นลูกจบแต้มที่ทรงพลังที่สุด มักตีตอนลูกลอยอยู่เหนือหัว'
        ],
        [
          "Clear (a high, deep shot): hits the shuttle high and deep to land near the back of the opponent's court — used to push the opponent back and buy time to reset position.",
          'Drop (a soft net shot): hits the shuttle so it barely clears the net and falls just on the other side — used to lure the opponent forward toward the net.',
          'Smash (a steep power shot): hits the shuttle down hard and fast at a steep angle — the most powerful point-finishing shot, usually struck while the shuttle is overhead.'
        ],
        buildBadmintonShotsSvg()),
      readingItem('ฟาวล์เพิ่มเติมและการหมุนตำแหน่งประเภทคู่', 'More Faults & Doubles Rotation',
        [
          'Let (เล่นใหม่): กรรมการสั่ง Let เมื่อเกิดเหตุขัดจังหวะที่ไม่เป็นความผิดของฝ่ายใด เช่น ลูกขนไก่ค้างอยู่บนตาข่ายหลังข้ามไปแล้ว หรือฝ่ายรับยังไม่พร้อมตอนเสิร์ฟ — แต้มนั้นจะเล่นใหม่โดยไม่มีใครเสียแต้ม',
          'ฟาวล์อื่นๆ ที่พบบ่อย: ผู้เล่นห้ามสัมผัสตาข่ายด้วยตัวหรือไม้แร็กเกตขณะลูกยังอยู่ในการเล่น ห้ามตีลูกก่อนที่ลูกจะข้ามมาถึงฝั่งตัวเอง (ต้องรอให้ลูกอยู่ฝั่งตัวเองก่อน) และห้ามส่งเสียงหรือทำท่าทางรบกวนสมาธิคู่แข่ง',
          'ในประเภทคู่ ทีมที่ชนะแต้ม (จากการเป็นฝ่ายรับ) จะได้สิทธิ์เสิร์ฟ แต่คู่ผู้เล่นในทีมนั้นไม่จำเป็นต้องสลับตำแหน่งเสิร์ฟกันเสมอ — ผู้เล่นที่อยู่ในตำแหน่งขวาตอนทีมได้แต้มจะเป็นคนเสิร์ฟ (คนที่เสิร์ฟครั้งก่อนอาจไม่ใช่คนเดิม) ทำให้การหมุนตำแหน่งซับซ้อนกว่าวอลเลย์บอล',
          'การจับไม้ (Grip) พื้นฐานมี 2 แบบ: Forehand Grip (จับแบบจับมือ เหมาะกับตีลูกฝั่งขวาลำตัว) และ Backhand Grip (หมุนนิ้วโป้งมาพาดสันไม้ เหมาะกับตีลูกฝั่งซ้ายลำตัวโดยไม่ต้องหมุนตัว)'
        ],
        [
          "A Let is called when there's an interruption that isn't either player's fault — e.g. the shuttlecock gets caught on top of the net after crossing over, or the receiver wasn't ready when served to. The point is simply replayed and nobody loses a point.",
          'Other common faults: a player may not touch the net with their body or racket while the shuttle is still in play, may not hit the shuttle before it has crossed to their own side, and may not make noise or gestures meant to distract the opponent.',
          "In doubles, whichever team wins the rally (by winning back the serve) earns the right to serve, but the two players on that team don't necessarily alternate who serves — whoever happens to be standing in the right-side court when the team wins the point serves next (it may not be the same player who served last time), making doubles rotation more complex than volleyball's.",
          'There are two basic grips: the Forehand Grip (like a handshake grip, suited to hitting shots on the racket-arm side) and the Backhand Grip (rotate the thumb onto the flat of the handle, suited to hitting shots on the non-racket side without turning the body).'
        ],
        svgFactStrip([
          { title: 'Let', sub: 'replay, no penalty', color: '#1971C2' },
          { title: '🚫 Net Touch', sub: 'while ball in play', color: '#E8590C' },
          { title: 'Forehand / Backhand', sub: '2 grips', color: '#2F9E44' }
        ], 'badminton more faults and grip facts diagram')),
      readingItem('กลยุทธ์การเล่นคู่: รูปแบบยืนหน้า-หลัง กับ ซ้าย-ขวา', 'Doubles Strategy: Front-Back vs Side-by-Side Formations',
        [
          'รูปแบบยืนหน้า-หลัง (Front-Back Formation): ผู้เล่นคนหนึ่งยืนใกล้ตาข่ายคอยสกัด/ตบลูกสั้น อีกคนยืนลึกคอยรับ Clear และตบลูกไกล ใช้เมื่อทีมเป็นฝ่ายรุก (เพิ่งเสิร์ฟหรือกำลังกดดันคู่แข่ง) เพราะแบ่งหน้าที่ชัดเจนระหว่างเกมหน้าตาข่ายกับเกมหลังสนาม',
          'รูปแบบซ้าย-ขวา (Side-by-Side Formation): ผู้เล่นสองคนยืนขนานกันแบ่งซ้าย-ขวาคุมคนละครึ่งสนาม ใช้เมื่อทีมเป็นฝ่ายรับ (เพิ่งเสียลูกให้คู่แข่งตบ) เพราะครอบคลุมพื้นที่กว้างเท่ากันทั้งสนาม ป้องกันลูกตบจากทุกมุมได้ดีกว่า',
          'ทีมคู่ระดับสูงจะสลับรูปแบบไปมาตลอดแรลลี่ตามสถานการณ์ — เปลี่ยนจาก Side-by-Side เป็น Front-Back ทันทีที่ได้จังหวะรุก แล้วสลับกลับเมื่อถูกคู่แข่งตบใส่ ความสามารถในการอ่านจังหวะและสลับตำแหน่งเร็วคือหัวใจของการเล่นคู่ระดับสูง'
        ],
        [
          "Front-Back Formation: one player stands close to the net to intercept and put away short shots, while the other stays deep to handle clears and return smashes. It's used when the team is on the attack (just after serving or pressuring the opponent), splitting responsibilities clearly between the net game and the rear-court game.",
          "Side-by-Side Formation: the two players stand parallel, each covering one half of the court (left/right). It's used when the team is on defense (just after the opponent has smashed), because it covers the width of the court evenly and defends against attacks from any angle better.",
          "High-level doubles pairs switch between formations constantly within a single rally, depending on the moment — switching from Side-by-Side to Front-Back the instant they get an attacking opportunity, then back again when the opponent smashes. The ability to read the moment and switch formation quickly is the core skill of high-level doubles play."
        ],
        buildBadmintonDoublesFormationSvg()),
      readingItem('ลูกตีขั้นสูง: Net Shot, Drive และ Around-the-Head', 'Advanced Shots: Net Shot, Drive & Around-the-Head',
        [
          'Net Shot (ลูกหน้าตาข่าย): ตีลูกเบาๆ ให้ข้ามตาข่ายแค่พอดีแล้วร่วงลงใกล้ตาข่ายฝั่งคู่แข่งมากที่สุด ต้องควบคุมแรงตีให้นุ่มนวล มักใช้ตอบโต้ลูก Drop ของคู่แข่งหรือเปิดเกมบีบให้คู่แข่งต้องก้มตัวรับใกล้พื้น',
          'Drive (ลูกขนาน): ตีลูกให้พุ่งขนานกับพื้นและตาข่ายด้วยความเร็วสูง ไม่มีความโด่ง มักใช้แลกหมัดกันในจังหวะกลางสนามเพื่อไม่ให้คู่แข่งมีเวลาตั้งท่าตบ เป็นลูกที่ต้องอาศัยปฏิกิริยาตอบสนองเร็ว',
          'Around-the-Head Stroke (ตีเหนือหัวข้ามฝั่งลำตัว): ใช้ตอนลูกลอยมาทางไหล่ฝั่งตรงข้ามกับมือถือแร็กเกต (เช่น คนถนัดขวา ลูกลอยมาทางไหล่ซ้าย) แทนที่จะตีแบ็คแฮนด์ที่มีแรงน้อยกว่า ผู้เล่นจะเอื้อมแร็กเกตข้ามศีรษะไปตีด้วยท่าเดียวกับฟอร์แฮนด์ ทำให้ได้แรงตีที่หนักกว่าแบ็คแฮนด์มาก',
          'การเลือกใช้ลูกตีแต่ละแบบขึ้นอยู่กับจังหวะเกม: Net Shot และ Drop เหมาะกับการควบคุมจังหวะให้ช้าลง ส่วน Drive และ Smash เหมาะกับการเร่งจังหวะให้เร็วขึ้นเพื่อจบแต้ม'
        ],
        [
          "Net Shot: a soft touch that just clears the net and drops as close to the net as possible on the opponent's side. It requires very gentle touch control, and is often used to answer an opponent's Drop shot or to force the opponent to bend down low to retrieve it.",
          "Drive: a shot hit flat and fast, parallel to the floor and the net, with no arc. It's often used to trade fast exchanges in the mid-court so the opponent has no time to set up a smash — a shot that demands quick reflexes.",
          "Around-the-Head Stroke: used when the shuttle floats toward the shoulder on the opposite side from the racket hand (e.g. for a right-handed player, a shuttle floating toward the left shoulder). Instead of hitting a weaker backhand, the player reaches the racket up and over the head to strike with a forehand-style motion, producing far more power than a backhand.",
          "Which shot to use depends on the rhythm of the rally: Net Shots and Drops are suited to slowing the pace down, while Drives and Smashes are suited to speeding the pace up to finish the point."
        ],
        svgFactStrip([
          { title: 'Net Shot', sub: 'soft, close to net', color: '#2F9E44' },
          { title: 'Drive', sub: 'flat and fast', color: '#E8590C' },
          { title: 'Around-the-Head', sub: 'forehand power, off-side', color: '#1971C2' }
        ], 'badminton advanced shots facts diagram'))
    ]
  },
  {
    id: 'tennis-basics',
    label: { th: 'เทนนิส: กติกาพื้นฐาน', en: 'Tennis: Basic Rules' },
    group: { th: 'เทนนิส', en: 'Tennis' },
    items: [
      readingItem('รู้จักเทนนิส', 'Meet Tennis',
        [
          'เทนนิส (Tennis) เล่นได้ทั้งประเภทเดี่ยว (Singles) และประเภทคู่ (Doubles) ตีลูกบอลข้ามตาข่ายด้วยไม้เทนนิส (Racket) ให้ตกในเขตสนามของฝ่ายตรงข้าม โดยยอมให้บอลเด้งพื้นได้ 1 ครั้งก่อนตีกลับ',
          'ระบบคะแนนในแต่ละเกม (Game) นับแบบพิเศษ: 0 = Love, 1 แต้ม = 15, 2 แต้ม = 30, 3 แต้ม = 40, แต้มที่ 4 ชนะเกม (ถ้าคู่ต่อสู้มี 40 เท่ากันด้วย เรียกว่า Deuce ต้องนำห่าง 2 แต้มถึงชนะ)',
          'การแข่งขันแบ่งเป็นเซต (Set) — ผู้เล่น/ทีมที่ชนะ 6 เกมก่อน (นำห่างอย่างน้อย 2 เกม) เป็นผู้ชนะเซต ถ้าเกมเสมอ 6-6 มักใช้ระบบ Tie-Break ตัดสิน แมตช์ทั่วไปเล่นแบบ Best of 3 เซต (บางทัวร์นาเมนต์ประเภทชายเดี่ยวใช้ Best of 5)'
        ],
        [
          'Tennis can be played Singles or Doubles. Players hit the ball over the net with a racket so it lands inside the opponent\'s court, and are allowed one bounce on their side before returning it.',
          "Scoring within a game uses a special sequence: 0 = Love, 1 point = 15, 2 points = 30, 3 points = 40, and the 4th point wins the game (if both reach 40, it's called Deuce, and a player must win by a 2-point margin).",
          'A match is divided into sets — the first player/team to win 6 games (by a margin of at least 2) wins the set. If the game score reaches 6-6, a Tie-Break usually decides the set. A typical match is best-of-3 sets (some men\'s tournaments use best-of-5).'
        ],
        svgFactStrip([
          { title: '1v1 / 2v2', sub: 'singles or doubles', color: '#2F6DA6' },
          { title: '0-15-30-40', sub: 'game scoring', color: '#2F6DA6' },
          { title: 'Best of 3', sub: 'sets to win', color: '#1971C2' }
        ], 'tennis match facts diagram')),
      readingItem('การเสิร์ฟและกติกาสำคัญ', 'Serving & Key Rules',
        [
          'การเสิร์ฟ (Serve): ผู้เล่นต้องยืนหลังเส้นท้ายสนามแล้วโยนบอลขึ้นตีข้ามตาข่ายลงในช่องเสิร์ฟทแยงมุมฝั่งตรงข้าม มีสิทธิ์เสิร์ฟผิดพลาดได้ 1 ครั้ง (Fault) ถ้าผิดครั้งที่ 2 ติดกัน (Double Fault) เสียแต้มทันที',
          "ถ้าเสิร์ฟแล้วบอลโดนตาข่ายแต่ยังตกในช่องเสิร์ฟที่ถูกต้อง เรียกว่า 'Let' ให้เสิร์ฟใหม่โดยไม่นับเป็นการเสิร์ฟเสีย",
          "ลูกที่ถือว่า 'ออก' (Out) คือลูกที่ตกนอกเส้นสนาม หรือลูกที่เด้งพื้นฝั่งตัวเอง 2 ครั้งก่อนตีกลับ หรือลูกที่ตีไม่ข้ามตาข่าย — ทุกกรณีทำให้อีกฝ่ายได้แต้มทันที"
        ],
        [
          'The Serve: a player stands behind the baseline, tosses the ball up, and hits it over the net into the diagonally opposite service box. One serve fault is allowed — a second consecutive fault (a Double Fault) loses the point immediately.',
          "If a serve touches the net but still lands in the correct service box, it's called a 'Let' — the serve is simply retaken and does not count as a fault.",
          "A ball is called 'out' if it lands outside the court lines, if a player lets it bounce twice on their own side before returning it, or if it fails to clear the net — in every case, the other side scores the point immediately."
        ],
        svgFactStrip([
          { title: '1 Fault OK', sub: '2nd = Double Fault', color: '#E8590C' },
          { title: 'Let', sub: 'net + in = replay', color: '#1971C2' },
          { title: '2 Bounces', sub: '= point lost', color: '#2F6DA6' }
        ], 'tennis serving and key rules facts diagram')),
      readingItem('เส้นสนามเทนนิสและช่องเสิร์ฟ', 'Tennis Court Lines & Service Boxes',
        [
          "สนามเทนนิสมีเส้นข้าง 2 ชุดเหมือนแบดมินตัน: เส้นสนามเดี่ยว (ด้านใน) และเส้นสนามคู่ (ด้านนอก รวมเลนกว้างพิเศษเรียก 'Doubles Alley' ที่ใช้เฉพาะประเภทคู่)",
          "ใกล้ตาข่ายมี 'เส้นเสิร์ฟ' (Service Line) ขนานกับตาข่าย ตัดกับ 'เส้นกึ่งกลาง' (Center Service Line) แบ่งพื้นที่ใกล้ตาข่ายแต่ละฝั่งออกเป็น 2 ช่องเสิร์ฟ (Service Box) ซ้าย-ขวา",
          'กติกาสำคัญ: ลูกเสิร์ฟต้องข้ามตาข่ายไปตกในช่องเสิร์ฟทแยงมุมฝั่งตรงข้ามเสมอ ห้ามเสิร์ฟลงช่องตรงหน้าตัวเอง'
        ],
        [
          "A tennis court has two sets of sidelines like badminton: the singles sidelines (inner) and doubles sidelines (outer, including an extra-wide lane called the 'Doubles Alley' used only in doubles play).",
          "Near the net there's a 'Service Line' running parallel to the net, crossed by the 'Center Service Line', dividing the near-net area on each side into 2 left-right service boxes.",
          'Key rule: a serve must cross the net and land in the diagonally opposite service box — never the box straight ahead of the server.'
        ],
        buildTennisCourtSvg()),
      readingItem('ตำแหน่งเสิร์ฟ: ขวาเมื่อคะแนนคู่ ซ้ายเมื่อคะแนนคี่', 'Serve Position: Right on Even, Left on Odd',
        [
          'ผู้เสิร์ฟต้องยืนสลับฝั่งตามคะแนนของตัวเองในเกมนั้น: คะแนนเป็นเลขคู่ (0, 15-15, 30-30 ฯลฯ) เสิร์ฟจากฝั่งขวาของสนาม คะแนนเป็นเลขคี่เสิร์ฟจากฝั่งซ้าย',
          "ไม่ว่าจะเสิร์ฟจากฝั่งไหน บอลต้องพุ่งข้ามตาข่ายแบบทแยงมุมเสมอ ไปตกในช่องเสิร์ฟฝั่งตรงข้ามที่ 'ไม่ตรงหน้า' ผู้เสิร์ฟ — ดูไดอะแกรมด้านล่างประกอบ",
          'กติกานี้มีไว้เพื่อให้เกมยุติธรรม: ทั้งสองฝ่ายต้องเสิร์ฟและรับเสิร์ฟจากทั้งสองฝั่งสลับกันไปตลอดทั้งเกม'
        ],
        [
          'The server must alternate sides based on their own score in that game: an even point count (0, 15-15, 30-30, etc.) serves from the right side of the court; an odd count serves from the left side.',
          'Regardless of which side, the ball must always cross the net diagonally, landing in the opposite service box that is NOT directly ahead of the server — see the diagram below.',
          'This rule keeps the game fair: both players must serve and receive from both sides in alternation throughout the match.'
        ],
        buildTennisServeSvg()),
      readingItem('กติกาเพิ่มเติม: ไทเบรก เสิร์ฟผิดกติกา และประเภทคู่', 'More Rules: Tie-Breaks, Foot Faults & Doubles',
        [
          'Tie-Break: เมื่อเกมในเซตเสมอ 6-6 มักเล่นไทเบรกตัดสิน นับคะแนนแบบธรรมดา (1, 2, 3...) แทนระบบ 15-30-40 ฝ่ายแรกที่ทำได้ 7 แต้ม (นำห่างอย่างน้อย 2 แต้ม) เป็นผู้ชนะเซตนั้นไปด้วยสกอร์ 7-6',
          'Foot Fault: ขณะเสิร์ฟ ผู้เล่นห้ามเหยียบหรือก้าวข้ามเส้นหลังสนาม (Baseline) ก่อนตีลูกออกจากมือ ถ้าทำถือเป็น Foot Fault นับเป็นการเสิร์ฟเสีย 1 ครั้งเหมือน Fault ทั่วไป',
          'ในประเภทคู่ (Doubles) คู่ผู้เล่นแต่ละทีมต้องผลัดกันเสิร์ฟทั้งเกม (คนที่ 1 เสิร์ฟเกมที่ 1 คนที่ 2 ของทีมเดียวกันเสิร์ฟเกมที่ 3 สลับกับคู่ต่อสู้) และต้องผลัดกันรับเสิร์ฟฝั่งขวา-ซ้ายเช่นเดียวกับกฎรับเสิร์ฟของประเภทเดี่ยว',
          "ระบบให้คะแนนทางเลือก 'No-Ad' (ไม่มี Deuce/Advantage): บางทัวร์นาเมนต์ใช้ระบบนี้เพื่อร่นเวลาแข่ง — ถ้าคะแนนถึง 40-40 แต้มถัดไปตัดสินเกมทันที (Sudden Death) โดยฝ่ายรับเลือกได้ว่าจะรับจากฝั่งไหน"
        ],
        [
          'A Tie-Break decides a set when the game score reaches 6-6. Scoring switches to simple counting (1, 2, 3...) instead of 15-30-40 — the first side to reach 7 points (by a margin of at least 2) wins the set, typically recorded as 7-6.',
          'A Foot Fault happens if a server steps on or over the baseline before striking the ball on serve — it counts as one fault, just like any other serve fault.',
          'In Doubles, the two players on a team take turns serving throughout the match (player 1 serves game 1, player 2 serves game 3, alternating with the opposing pair), and they also alternate which side (right/left) they return serve from, the same as the singles rule.',
          "An alternative scoring system called 'No-Ad' (no Deuce/Advantage) is used by some tournaments to shorten matches — if the score reaches 40-40, the very next point decides the game outright (sudden death), and the receiving side chooses which side to return from."
        ],
        svgFactStrip([
          { title: 'Tie-Break', sub: 'first to 7 at 6-6', color: '#1971C2' },
          { title: '🚫 Foot Fault', sub: 'stepping on baseline', color: '#E8590C' },
          { title: 'No-Ad', sub: 'sudden death at 40-40', color: '#2F6DA6' }
        ], 'tennis tiebreak foot fault and no-ad rules diagram')),
      readingItem('ประเภทการตีลูกพื้นฐาน: Forehand, Backhand และ Volley', 'Basic Shot Types: Forehand, Backhand & Volley',
        [
          'Forehand (ลูกหน้ามือ): ตีลูกด้วยฝ่ามือด้านเดียวกับมือที่ถือแร็กเกต เป็นลูกพื้นฐานที่ทรงพลังที่สุดสำหรับผู้เล่นส่วนใหญ่ เพราะแขนเคลื่อนที่เป็นธรรมชาติและควบคุมง่าย',
          'Backhand (ลูกหลังมือ): ตีลูกด้วยฝ่ามือด้านตรงข้ามกับมือถือแร็กเกต มีทั้งแบบมือเดียว (One-Handed) ที่เอื้อมได้ไกลกว่า และแบบสองมือ (Two-Handed) ที่มั่นคงและควบคุมทิศทางง่ายกว่า นิยมในผู้เล่นอาชีพยุคปัจจุบัน',
          'Volley (ลูกตีก่อนบอลตกพื้น): ตีลูกกลางอากาศก่อนที่บอลจะเด้งพื้น มักทำตอนยืนใกล้ตาข่าย (ดูโซนสีเหลืองในไดอะแกรมด้านล่าง) ใช้ท่าตีสั้นกระชับไม่มีการเหวี่ยงแขนแรงเหมือนกราวด์สโตรก เพราะบอลมาเร็วและมีเวลาเตรียมตัวน้อย',
          'Groundstroke (ลูกตีหลังบอลเด้งพื้นครั้งเดียว) คือ Forehand/Backhand ที่ตีตอนยืนใกล้เส้นหลังสนาม (โซนสีส้มในไดอะแกรม) เป็นลูกพื้นฐานที่ใช้บ่อยที่สุดในเกม ผู้เล่นสไตล์ Baseline มักใช้ลูกนี้เป็นหลักในการแลกหมัดยาวๆ'
        ],
        [
          'Forehand: a shot struck with the palm facing the same side as the racket hand. It\'s the most powerful basic shot for most players, since the arm\'s natural swing path makes it easier to control.',
          'Backhand: a shot struck with the palm facing the opposite side from the racket hand. There\'s a One-Handed version (which reaches further) and a Two-Handed version (which is more stable and easier to direct) — the two-handed backhand is popular among today\'s professional players.',
          'Volley: hitting the ball out of the air before it bounces. It\'s typically played while standing close to the net (see the yellow zone in the diagram below), using a short, compact stroke rather than a big swing like a groundstroke, since the ball arrives fast and there\'s little time to prepare.',
          'A Groundstroke (a Forehand or Backhand hit after the ball has bounced once) is typically played from near the baseline (the orange zone in the diagram) — the most frequently used shot in the game. Baseline-style players rely on groundstrokes as their main weapon in long rallies.'
        ],
        buildTennisShotZonesSvg()),
      readingItem('กลยุทธ์การเล่น: Baseline กับ Serve-and-Volley และพื้นสนามแต่ละประเภท', 'Playing Styles: Baseline vs Serve-and-Volley, and Court Surfaces',
        [
          'สไตล์ Baseline: ผู้เล่นยืนแลกลูกใกล้เส้นหลังสนามเป็นหลัก อาศัยความแม่นยำและความอึดในการวิ่งไล่ลูก รอจังหวะที่คู่แข่งเสียท่าจึงจะบุกขึ้นไปจบแต้ม เป็นสไตล์ที่นิยมที่สุดในเทนนิสยุคปัจจุบัน',
          'สไตล์ Serve-and-Volley: ผู้เล่นวิ่งบุกขึ้นไปยืนใกล้ตาข่ายทันทีหลังเสิร์ฟ เพื่อจบแต้มด้วยการวอลเลย์ก่อนคู่แข่งจะตั้งตัวได้ ต้องอาศัยการเสิร์ฟที่ทรงพลังและปฏิกิริยาตอบสนองที่รวดเร็ว สไตล์นี้พบน้อยลงในปัจจุบันแต่ยังใช้ได้ผลบนพื้นสนามเร็ว',
          'สนามดิน (Clay Court): พื้นผิวช้าและบอลเด้งสูง ทำให้แลกลูกได้ยาวนาน เหมาะกับสไตล์ Baseline — สนามหญ้า (Grass Court): พื้นผิวเร็วและบอลเด้งต่ำ เหมาะกับสไตล์ Serve-and-Volley และลูกเสิร์ฟที่ทรงพลัง — สนามฮาร์ดคอร์ต (Hard Court): ความเร็วปานกลาง เป็นพื้นสนามที่ใช้เล่นกันมากที่สุดในระดับทัวร์นาเมนต์ทั่วไป',
          'รายการแกรนด์สแลม (Grand Slam) ทั้ง 4 รายการใช้พื้นสนามต่างกัน: Australian Open และ US Open ใช้ฮาร์ดคอร์ต, French Open (Roland Garros) ใช้สนามดิน, และ Wimbledon ใช้สนามหญ้า — นักเทนนิสระดับโลกจึงต้องปรับสไตล์การเล่นให้เข้ากับพื้นสนามแต่ละประเภท'
        ],
        [
          'The Baseline style: the player stays mainly near the baseline trading groundstrokes, relying on accuracy and stamina to chase down shots, waiting for the opponent to be caught off balance before advancing to finish the point. It\'s the most common style in tennis today.',
          'The Serve-and-Volley style: the player rushes forward to the net immediately after serving, aiming to finish the point with a volley before the opponent can set up. It requires a powerful serve and quick reflexes. This style is less common today but still effective on fast courts.',
          'Clay Courts: a slow surface with a high bounce, favoring long rallies and the Baseline style. Grass Courts: a fast surface with a low bounce, favoring Serve-and-Volley and powerful serves. Hard Courts: medium speed, and the most commonly used surface at general tournament level.',
          'The four Grand Slam tournaments each use a different surface: the Australian Open and US Open are played on hard courts, the French Open (Roland Garros) on clay, and Wimbledon on grass — so top-level players must adapt their playing style to each surface.'
        ],
        svgFactStrip([
          { title: 'Baseline', sub: 'long rallies', color: '#2F6DA6' },
          { title: 'Serve-and-Volley', sub: 'rush the net', color: '#E8590C' },
          { title: 'Clay/Grass/Hard', sub: '3 surfaces', color: '#2F9E44' }
        ], 'tennis playing styles and court surfaces diagram'))
    ]
  },
  {
    id: 'table-tennis-basics',
    label: { th: 'เทเบิลเทนนิส: กติกาพื้นฐาน', en: 'Table Tennis: Basic Rules' },
    group: { th: 'เทเบิลเทนนิส', en: 'Table Tennis' },
    items: [
      readingItem('รู้จักเทเบิลเทนนิส', 'Meet Table Tennis',
        [
          'เทเบิลเทนนิส (Table Tennis) หรือปิงปอง เล่นได้ทั้งประเภทเดี่ยว (Singles) และประเภทคู่ (Doubles) ตีลูกบอลพลาสติกเล็กๆ ข้ามตาข่ายให้ตกในเขตโต๊ะของฝ่ายตรงข้าม โดยยอมให้บอลเด้งพื้นโต๊ะฝั่งตัวเองได้ 1 ครั้งก่อนตีกลับเท่านั้น',
          'การแข่งขันเล่นแบบ Best of 7 เกม (ชนะ 4 ใน 7 เกม) หรือ Best of 5 เกมแล้วแต่รายการ แต่ละเกมเล่นถึง 11 แต้ม ต้องนำอย่างน้อย 2 แต้มถึงจะชนะเกม (ถ้าเสมอ 10-10 ต้องนำห่าง 2 แต้มไปเรื่อยๆ ไม่มีเพดานแต้ม)',
          "ใช้ระบบ 'Rally Point System' เช่นเดียวกับแบดมินตัน — ได้แต้มทุกครั้งที่ชนะแรลลี่นั้น ไม่ว่าฝ่ายไหนเป็นฝ่ายเสิร์ฟ"
        ],
        [
          "Table Tennis (or Ping-Pong) can be played Singles or Doubles. Players hit a small plastic ball over the net so it lands inside the opponent's half of the table, and are allowed one bounce on their own side before returning it.",
          'A match is played best-of-7 games (first to win 4) or best-of-5 depending on the competition. Each game is played to 11 points, won by a margin of at least 2 (if tied 10-10, play continues until a 2-point lead — there is no point cap).',
          "It uses a 'Rally Point System' just like badminton — a point is scored on every rally regardless of who served."
        ],
        svgFactStrip([
          { title: '1v1 / 2v2', sub: 'singles or doubles', color: '#1971C2' },
          { title: '11 pts', sub: 'per game, win by 2', color: '#1971C2' },
          { title: 'Best of 7', sub: 'games to win', color: '#2F9E44' }
        ], 'table tennis match facts diagram')),
      readingItem('การเสิร์ฟและกติกาสำคัญ', 'Serving & Key Rules',
        [
          "การเสิร์ฟ (Serve): ผู้เล่นต้องโยนลูกบอลขึ้นในแนวดิ่งอย่างน้อย 16 ซม. จากฝ่ามือที่แบเรียบ แล้วตีให้ลูกเด้งบนโต๊ะฝั่งตัวเองก่อน 1 ครั้ง จากนั้นข้ามตาข่ายไปเด้งบนโต๊ะฝั่งคู่แข่งอีก 1 ครั้ง",
          "สิทธิ์เสิร์ฟจะสลับกันทุกๆ 2 แต้ม (ยกเว้นช่วงคะแนน 10-10 ขึ้นไป ที่จะสลับเสิร์ฟทุก 1 แต้มแทน) เพื่อไม่ให้ฝ่ายใดได้เปรียบจากการเสิร์ฟต่อเนื่องนานเกินไป",
          "ถ้าเสิร์ฟแล้วลูกโดนตาข่ายแต่ยังข้ามไปเด้งถูกต้องในโต๊ะฝั่งคู่แข่ง เรียกว่า 'Let' ให้เสิร์ฟใหม่โดยไม่นับเป็นการเสียแต้มหรือเสียสิทธิ์แต่อย่างใด"
        ],
        [
          'The Serve: a player must toss the ball vertically at least 16 cm from an open, flat palm, then strike it so it bounces once on their own side of the table first, crosses the net, and bounces once on the opponent\'s side.',
          "The right to serve switches every 2 points (except once the score reaches 10-10 or higher, when it switches every 1 point instead), so no side benefits from serving for too long in a row.",
          "If a serve touches the net but still crosses over and bounces correctly on the opponent's side, it's called a 'Let' — the serve is simply retaken and doesn't count against either side."
        ],
        svgFactStrip([
          { title: '16 cm Toss', sub: 'minimum serve height', color: '#1971C2' },
          { title: 'Every 2 pts', sub: 'serve alternates', color: '#2F9E44' },
          { title: 'Let', sub: 'net + in = replay', color: '#E8590C' }
        ], 'table tennis serving and key rules facts diagram')),
      readingItem('เส้นสนามและอุปกรณ์', 'The Table & Equipment',
        [
          'โต๊ะมาตรฐานมีขนาด 2.74 x 1.525 เมตร สูงจากพื้น 76 ซม. ตาข่ายกลางโต๊ะสูง 15.25 ซม. — เตี้ยกว่าตาข่ายกีฬาอื่นๆ มากเพราะลูกบอลเบาและตีระยะใกล้',
          "เส้นกึ่งกลางโต๊ะ (Center Line) แบ่งแต่ละฝั่งออกเป็นซ้าย-ขวา ใช้เฉพาะตอนเสิร์ฟในประเภทคู่เท่านั้น: ผู้เสิร์ฟต้องเสิร์ฟจากช่องขวาของตัวเองไปยังช่องขวาของคู่แข่งเสมอ (ดูไดอะแกรมด้านล่างประกอบ)",
          "ไม้ปิงปอง (Paddle/Racket) มี 2 แบบการจับหลัก: Shakehand Grip (จับเหมือนจับมือ นิยมในนักกีฬาตะวันตก) และ Penhold Grip (จับเหมือนจับปากกา นิยมในนักกีฬาเอเชียตะวันออก) แต่ละแบบเหมาะกับสไตล์การเล่นที่ต่างกัน"
        ],
        [
          'A standard table is 2.74 x 1.525 meters, 76 cm above the floor. The net across the middle stands just 15.25 cm tall — much lower than in other net sports, since the ball is light and play happens at close range.',
          "The table's Center Line divides each side into left and right halves, and is only relevant when serving in doubles: the server must always serve from their own right-hand box to the opponent's right-hand box (see the diagram below).",
          'There are two main paddle grips: the Shakehand Grip (held like shaking hands, popular among Western players) and the Penhold Grip (held like holding a pen, popular among East Asian players) — each suits a different playing style.'
        ],
        buildTableTennisTableSvg()),
      readingItem('เทคนิคการตีพื้นฐาน: Drive, Push และ Chop', 'Basic Strokes: Drive, Push & Chop',
        [
          'Drive (ลูกรุก): ตีลูกด้วยแรงหมุนม้วนหน้า (Topspin) เป็นลูกโจมตีพื้นฐานที่สุด ใช้ทั้ง Forehand Drive (ฝั่งถนัด) และ Backhand Drive (ฝั่งตรงข้าม) เพื่อกดดันคู่แข่งด้วยความเร็วและแรงหมุน',
          'Push (ลูกดัน): ตีลูกเบาๆ พร้อมใส่แรงหมุนตัด (Backspin) เล็กน้อย เป็นลูกตอบโต้แบบปลอดภัยเมื่อลูกของคู่แข่งมีแรงหมุนตัดมาก ใช้ควบคุมจังหวะให้ช้าลง',
          'Chop (ลูกตัด): ตีลูกด้วยแรงหมุนตัด (Backspin) หนักและถอยห่างจากโต๊ะ เป็นท่าเล่นเชิงรับที่ใช้ตอบโต้ลูกตบแรงๆ ของคู่แข่ง ทำให้บอลลอยช้าและตกใกล้ตาข่ายเมื่อคู่แข่งพยายามตีกลับ'
        ],
        [
          'Drive: struck with topspin, the most basic attacking stroke. There\'s a Forehand Drive (on the racket-hand side) and a Backhand Drive (on the opposite side), used to pressure the opponent with speed and spin.',
          'Push: a soft stroke with a small amount of backspin added, used as a safe reply when the opponent\'s shot carries heavy backspin — it slows the pace of the rally down.',
          'Chop: struck with heavy backspin while standing back from the table — a defensive stroke used to answer an opponent\'s hard attacking shots, making the ball float slowly and drop short when the opponent tries to attack it.'
        ],
        svgFactStrip([
          { title: 'Drive', sub: 'topspin attack', color: '#E8590C' },
          { title: 'Push', sub: 'soft, safe reply', color: '#2F9E44' },
          { title: 'Chop', sub: 'heavy backspin defense', color: '#1971C2' }
        ], 'table tennis drive push chop stroke facts diagram')),
      readingItem('การหมุนของลูก: Topspin กับ Backspin', 'Ball Spin: Topspin vs Backspin',
        [
          'Topspin (ลูกม้วนหน้า): บอลหมุนไปข้างหน้า ทำให้บอลพุ่งโค้งลงเร็วหลังข้ามตาข่าย และกระดอนพุ่งไปข้างหน้าแรงเมื่อโดนไม้คู่แข่ง เป็นแรงหมุนหลักของลูกโจมตีสมัยใหม่ ดูไดอะแกรมด้านล่างประกอบ',
          'Backspin (ลูกตัด): บอลหมุนย้อนกลับ ทำให้บอลลอยแบนราบกว่าและตกช้ากว่า Topspin ถ้าคู่แข่งตีกลับแรงเกินไปโดยไม่ปรับมุมไม้ บอลมักจะติดตาข่ายหรือออกนอกโต๊ะ',
          'นักกีฬาต้องอ่านแรงหมุนจากมุมไม้และจังหวะการสวิงของคู่แข่งก่อนตอบโต้ ถ้าอ่านแรงหมุนผิดพลาด มักตีบอลออกนอกโต๊ะหรือติดตาข่ายเพราะปรับมุมไม้ไม่ถูก'
        ],
        [
          "Topspin: the ball spins forward, making it dip down sharply right after crossing the net and rebound forward hard off the opponent's paddle — the main spin behind modern attacking play. See the diagram below.",
          "Backspin: the ball spins backward, making it float flatter and drop later than topspin. If the opponent hits back too hard without adjusting the paddle angle, the ball often clips the net or flies off the table.",
          "Players must read the spin from the opponent's paddle angle and swing motion before responding — misreading the spin usually sends the return long off the table or into the net because the paddle angle wasn't adjusted correctly."
        ],
        buildTableTennisSpinSvg())
    ]
  },
  {
    id: 'muay-thai-basics',
    label: { th: 'มวยไทย: กติกาพื้นฐาน', en: 'Muay Thai: Basic Rules' },
    group: { th: 'มวยไทย', en: 'Muay Thai' },
    items: [
      readingItem('รู้จักมวยไทย', 'Meet Muay Thai',
        [
          "มวยไทย (Muay Thai) เป็นศิลปะการต่อสู้ประจำชาติไทย ได้ฉายาว่า 'ศาสตร์แห่งแขนขาทั้งแปด' (The Art of Eight Limbs) เพราะใช้อวัยวะโจมตีได้ถึง 8 จุด คือ หมัดสองข้าง ศอกสองข้าง เข่าสองข้าง และหน้าแข้ง/เท้าสองข้าง ต่างจากมวยสากลที่ใช้แค่หมัด",
          'การแข่งขันมาตรฐานมี 5 ยก ยกละ 3 นาที พักระหว่างยก 2 นาที (จำนวนยกและเวลาอาจต่างกันไปตามรายการและสมาคม)',
          'ผลการแข่งขันตัดสินได้หลายทาง: น็อกเอาต์ (Knockout), กรรมการยุติการชก (TKO/Technical Knockout) เมื่อนักกีฬาฝ่ายหนึ่งไม่สามารถป้องกันตัวต่อได้อย่างปลอดภัย, หรือให้คะแนนจากกรรมการ (Judges\' Decision) เมื่อครบยกโดยไม่มีใครถูกน็อก'
        ],
        [
          "Muay Thai is Thailand's national martial art, nicknamed 'The Art of Eight Limbs' because it allows striking with 8 points of contact — both fists, both elbows, both knees, and both shins/feet — unlike boxing, which uses fists only.",
          'A standard match has 5 rounds of 3 minutes each, with a 2-minute rest between rounds (the number of rounds and timing can vary by promotion and sanctioning body).',
          "The outcome can be decided several ways: Knockout (KO), a referee stoppage (TKO) when one fighter can no longer defend themselves safely, or a Judges' Decision on points when the fight goes the full distance without a knockout."
        ],
        svgFactStrip([
          { title: '8 Limbs', sub: 'fists/elbows/knees/shins', color: '#C92A2A' },
          { title: '5 x 3 min', sub: 'rounds', color: '#C92A2A' },
          { title: 'KO / TKO / Decision', sub: '3 ways to win', color: '#E8590C' }
        ], 'muay thai match facts diagram')),
      readingItem('การให้คะแนนและการชนะ', 'Scoring & Winning',
        [
          'การให้คะแนนมวยไทยแบบดั้งเดิมเน้นที่ "ความเหนือกว่าในสังเวียน" (Ring Dominance) และคุณภาพของหมัด/เท้าที่ทรงพลังและแม่นยำ มากกว่าการนับจำนวนครั้งที่ต่อยโดนแบบมวยสากล',
          'ท่าที่ให้คะแนนสูง ได้แก่ การเตะด้วยหน้าแข้งที่ทรงพลัง การใช้เข่าและศอกในระยะประชิด และการควบคุมคู่ต่อสู้ในการปล้ำประชิด (Clinch) — ยกหลังๆ (ยก 3-4) มักมีน้ำหนักคะแนนมากกว่ายกแรกๆ เพราะนักมวยมักเริ่มเกมด้วยการหยั่งเชิงคู่ต่อสู้ก่อน',
          'ความผิดกติกา (Fouls) เช่น กัด ข่วนตา โขกศีรษะ ต่อยตอนคู่ต่อสู้ล้มแล้ว หรือตีเป้าต่ำ (Groin Strike) จะถูกตัดคะแนนหรือปรับแพ้ทันทีในกรณีร้ายแรง'
        ],
        [
          "Traditional Muay Thai scoring emphasizes ring dominance and the quality of powerful, well-timed strikes — not simply counting how many strikes land the way boxing does.",
          'Highly-scoring actions include powerful shin kicks, knee and elbow strikes at close range, and controlling the opponent in the clinch. Later rounds (rounds 3-4) are often weighted more heavily than early rounds, since fighters typically spend the opening rounds feeling each other out.',
          'Fouls such as biting, eye-gouging, headbutting, striking a downed opponent, or groin strikes result in point deductions, or immediate disqualification for serious violations.'
        ],
        svgFactStrip([
          { title: 'Ring Dominance', sub: 'quality > quantity', color: '#E8590C' },
          { title: 'Knee/Elbow/Clinch', sub: 'high-scoring actions', color: '#C92A2A' },
          { title: 'Rounds 3-4', sub: 'weighted more', color: '#F5A524' }
        ], 'muay thai scoring facts diagram')),
      readingItem('ท่าโจมตีพื้นฐาน: หมัด ศอก เข่า เตะ', 'Basic Strikes: Punches, Elbows, Knees & Kicks',
        [
          'หมัด (Punches): ท่าพื้นฐานคล้ายมวยสากล เช่น หมัดตรง (Jab, Cross) และหมัดเหวี่ยง (Hook) ใช้เปิดเกมหรือสร้างจังหวะก่อนเข้าท่าอื่น',
          'ศอก (Elbows): มีหลายมุม เช่น ศอกตี (แนวนอน), ศอกงัด (แนวเฉียงขึ้น), ศอกกลับหลัง (หมุนตัว) เป็นอาวุธระยะประชิดที่สร้างบาดแผลได้รุนแรงที่สุด',
          'เข่า (Knees): เข่าตรงและเข่าเฉียง มักใช้ในจังหวะปล้ำประชิด (Clinch) เมื่อจับคอคู่ต่อสู้ไว้ได้แล้วกระแทกเข่าเข้าลำตัว',
          "เตะ (Kicks): ท่าเด่นที่สุดของมวยไทยคือเตะวงกลม (Roundhouse Kick) ที่ใช้ 'หน้าแข้ง' เป็นจุดกระทบแทนหลังเท้าแบบศิลปะการต่อสู้อื่น หมุนสะโพกเต็มที่เพื่อดึงแรงสูงสุด ส่วนการเตะถีบ (Teep หรือ Push Kick) ใช้ควบคุมระยะและดันคู่ต่อสู้ออกมากกว่าจะเน้นความแรง",
          'ดูภาพเคลื่อนไหวด้านล่างประกอบ — สาธิตท่าเตะวงกลม เตะถีบ และหมัดตรงคู่ (Jab-Cross) วนซ้ำให้ดูตามได้'
        ],
        [
          'Punches: basic techniques similar to boxing, such as straight punches (Jab, Cross) and hooks — used to open an exchange or set up rhythm before other strikes.',
          'Elbows: thrown from several angles — the horizontal elbow strike, the upward diagonal elbow, and the spinning elbow — the most damaging close-range weapon in the sport.',
          'Knees: straight knees and diagonal knees, most often thrown from the clinch once a fighter has control of the opponent\'s neck, driving the knee into the body.',
          "Kicks: Muay Thai's signature technique is the Roundhouse Kick, which strikes with the shin (rather than the foot/instep used in other martial arts), rotating the hip fully through for maximum power. The Teep (Push Kick) is used to control distance and push the opponent away rather than to strike with maximum force.",
          'See the animated diagram below — a looping demonstration of the roundhouse kick, teep, and jab-cross combination you can follow along with.'
        ],
        svgFactStrip([
          { title: 'Punch', sub: 'jab/cross/hook', color: '#1971C2' },
          { title: 'Elbow', sub: 'most damaging', color: '#E8590C' },
          { title: 'Knee', sub: 'from the clinch', color: '#C92A2A' },
          { title: 'Shin Kick', sub: 'signature technique', color: '#2F9E44' }
        ], 'muay thai basic strikes facts diagram') + buildMuayThaiTechniqueDemoSvg()),
      readingItem('การปล้ำประชิด (Clinch)', 'The Clinch',
        [
          "การปล้ำประชิด (Clinch) เป็นทักษะเฉพาะตัวของมวยไทยที่ไม่ค่อยพบในศิลปะการต่อสู้อื่น: นักมวยเข้าคุมคอคู่ต่อสู้ด้วยมือทั้งสองข้าง (ท่าที่เรียกว่า Double Collar Tie หรือ 'ปล้ำคอ') เพื่อควบคุมทิศทางศีรษะและลำตัวคู่ต่อสู้แล้วกระแทกเข่าเข้าลำตัวหรือใบหน้า",
          'ในจังหวะปล้ำประชิด สามารถใช้ "การทุ่ม" (Sweep) เพื่อทำให้คู่ต่อสู้เสียการทรงตัวหรือล้มลงได้ แต่ต่างจากมวยปล้ำ (Wrestling) ตรงที่ไม่ใช่การเข้าล็อกตัวเพื่อกดลงพื้นแบบต่อเนื่อง',
          'กรรมการจะแยกคู่นักมวยออกจากกันเมื่อการปล้ำประชิดหยุดนิ่งไม่มีการเคลื่อนไหวหรือทำคะแนนเป็นระยะเวลาหนึ่ง เพื่อให้เกมดำเนินต่อไปอย่างมีจังหวะ'
        ],
        [
          "The Clinch is a signature Muay Thai skill rarely seen in other martial arts: a fighter controls the opponent's neck with both hands (a position called the Double Collar Tie, or 'plum') to control the direction of the opponent's head and torso, then drives knee strikes into the body or face.",
          "Sweeps can be used from the clinch to off-balance or take the opponent down, but unlike wrestling, it isn't about locking up the body for a sustained takedown and ground control.",
          'Referees will break the fighters apart when a clinch stalls with no movement or scoring action for a period of time, to keep the fight moving.'
        ],
        svgFactStrip([
          { title: 'Double Collar Tie', sub: 'control the neck', color: '#E8590C' },
          { title: 'Sweep', sub: 'off-balance, not a takedown', color: '#C92A2A' },
          { title: 'Break', sub: 'ref separates if stalled', color: '#1971C2' }
        ], 'muay thai clinch facts diagram')),
      readingItem('พิธีไหว้ครูและวัฒนธรรม', 'Wai Kru & Cultural Significance',
        [
          "พิธีไหว้ครูรำมวย (Wai Kru Ram Muay) คือการแสดงความเคารพต่อครูฝึกและบูรพาจารย์ก่อนการชกทุกครั้ง เป็นการร่ายรำตามจังหวะดนตรี แต่ละค่ายมวยหรือนักมวยมักมีท่ารำเฉพาะตัวที่สืบทอดมาจากครูของตน",
          "มงคล (Mongkol) เป็นเครื่องประดับศีรษะที่สวมใส่ระหว่างพิธีไหว้ครู ครูฝึกจะถอดออกก่อนเริ่มการชกจริง ส่วนประเจียด (Pra Jiad) เป็นผ้าพันแขนที่นักมวยบางคนสวมใส่ไว้ตลอดการชกเพื่อความเป็นสิริมงคล",
          'วงดนตรีสรรเสริญ (Wong Sarama) ประกอบด้วยปี่ไทยและกลอง บรรเลงสดตลอดการชก จังหวะดนตรีจะเร่งเร็วขึ้นเรื่อยๆ ตามความเข้มข้นของการต่อสู้ ช่วยปลุกพลังให้ทั้งนักมวยและผู้ชม'
        ],
        [
          "The Wai Kru Ram Muay is a pre-fight ritual dance paying respect to one's teachers and the martial art's lineage, performed before every fight to the sound of live music — each gym or fighter typically has their own unique choreography passed down from their teacher.",
          "The Mongkol is a headband worn during the Wai Kru ceremony, removed by the trainer just before the fight begins. The Pra Jiad are armbands some fighters wear throughout the entire fight for good luck and protection.",
          "The Wong Sarama, a live band of a Thai oboe and drums, plays throughout the fight — the tempo speeds up as the action intensifies, helping build energy for both the fighters and the crowd."
        ],
        svgFactStrip([
          { title: 'Wai Kru', sub: 'pre-fight dance ritual', color: '#F5A524' },
          { title: 'Mongkol', sub: 'headband, removed pre-fight', color: '#E8590C' },
          { title: 'Wong Sarama', sub: 'live music band', color: '#1971C2' }
        ], 'muay thai wai kru and cultural facts diagram')),
      readingItem('ระยะการชกและการอ่านจังหวะคู่ต่อสู้', 'Fighting Ranges & Reading Rhythm',
        [
          'ระยะไกล (Long Range): ระยะที่ใช้เตะ (Kick) และเตะถีบ (Teep) เป็นหลัก เพราะขาเอื้อมได้ไกลกว่าแขน นักมวยมักใช้ระยะนี้ควบคุมพื้นที่และป้องกันไม่ให้คู่ต่อสู้เข้าใกล้',
          'ระยะกลาง (Mid Range): ระยะที่ใช้หมัดและเข่าลอย (เข่าที่ไม่ต้องปล้ำ) เป็นระยะเปลี่ยนผ่านระหว่างไกลกับใกล้ นักมวยต้องตัดสินใจเร็วว่าจะรุกต่อเข้าประชิดหรือถอยกลับไประยะไกล',
          'ระยะประชิด (Close Range): ระยะที่ใช้ศอกและเข่าในคลินช์เป็นหลัก อันตรายที่สุดเพราะแรงปะทะสูงและระยะสั้นทำให้หลบยาก นักมวยที่ถนัดคลินช์มักพยายามดึงเกมเข้าสู่ระยะนี้',
          'การอ่านจังหวะ (Timing) คือทักษะขั้นสูง: สังเกตจังหวะหายใจ การยกเท้าก่อนเตะ หรือการดึงไหล่ก่อนต่อยของคู่ต่อสู้ เพื่อคาดเดาและสวนกลับ (Counter) ก่อนที่ท่านั้นจะออกมาเต็มรูปแบบ'
        ],
        [
          'Long Range: the range where kicks and teeps (push kicks) dominate, since legs reach further than arms. Fighters use this range to control space and keep the opponent from closing in.',
          'Mid Range: the range for punches and standing knee strikes (not from the clinch) — a transitional range between long and close. A fighter must decide quickly whether to press forward into the clinch or retreat back to long range.',
          'Close Range: dominated by elbows and knees from the clinch — the most dangerous range because of the high impact and short distance that makes strikes hard to dodge. Fighters skilled at clinching often try to drag the fight into this range.',
          "Reading timing is an advanced skill: watching an opponent's breathing rhythm, a foot lifting before a kick, or a shoulder dropping before a punch, to anticipate and counter before the technique fully lands."
        ],
        svgFlowSteps([
          { title: 'Long', sub: 'kicks/teeps', color: '#1971C2' },
          { title: 'Mid', sub: 'punches/knees', color: '#2F9E44' },
          { title: 'Close', sub: 'elbows/clinch', color: '#E8590C' }
        ], 'muay thai fighting ranges flow diagram')),
      readingItem('รูปแบบนักมวยและกลยุทธ์', 'Fighter Styles & Strategy',
        [
          'Muay Mat (สายหมัด): นักมวยที่เน้นชกหมัดหนักและตรง เคลื่อนไหวเข้าออกเร็ว มักชนะด้วยการน็อก จุดอ่อนคือถ้าโดนเตะสวนบ่อยๆ ระยะไกลจะเสียเปรียบ',
          'Muay Tae (สายเตะ): นักมวยที่เน้นเตะหนักหน้าแข้งเป็นหลัก คุมระยะไกลได้ดี จุดอ่อนคือถ้าคู่ต่อสู้เข้าประชิดได้เร็วจะเสียเปรียบเพราะเตะใช้ระยะไม่ได้',
          'Muay Khao (สายเข่า): นักมวยที่ถนัดปล้ำประชิดและกระแทกเข่า มักตัวสูงและแข็งแรง ชนะด้วยการบั่นทอนพลังคู่ต่อสู้ในคลินช์ จุดอ่อนคือถ้าคู่ต่อสู้หลบคลินช์เก่งจะทำอะไรไม่ได้มาก',
          "Muay Femur (สายเทคนิค): นักมวยที่เน้นเทคนิคและการสวนกลับ (Counter) มากกว่าความแรง เคลื่อนไหวสวยงามและอ่านเกมเก่ง มักชนะด้วยคะแนนมากกว่าน็อก — ความสัมพันธ์ระหว่างแต่ละสไตล์มักเป็นแบบ 'ค้อน-กรรไกร-กระดาษ' ที่ไม่มีสไตล์ใดเหนือกว่าทุกสไตล์เสมอไป ขึ้นอยู่กับคู่ต่อสู้ที่เจอ"
        ],
        [
          'Muay Mat (Puncher): a fighter who relies on heavy, straight punches with fast in-and-out footwork, often winning by knockout. Their weakness is being outkicked repeatedly at long range.',
          'Muay Tae (Kicker): a fighter who relies on heavy shin kicks and controls the long range well. Their weakness is being at a disadvantage if the opponent can close the distance quickly, neutralizing the kicking range.',
          'Muay Khao (Knee Fighter): a fighter skilled in clinching and driving knee strikes, usually tall and strong, winning by wearing the opponent down in the clinch. Their weakness is struggling if the opponent is skilled at avoiding the clinch.',
          "Muay Femur (Technician): a fighter who relies on technique and counters rather than raw power, moving elegantly and reading the fight well, usually winning on points rather than knockout — the relationship between these styles is often like 'rock-paper-scissors', where no single style dominates every matchup; it depends on who the opponent is."
        ],
        svgFactStrip([
          { title: 'Muay Mat', sub: 'puncher', color: '#1971C2' },
          { title: 'Muay Tae', sub: 'kicker', color: '#2F9E44' },
          { title: 'Muay Khao', sub: 'knee fighter', color: '#E8590C' },
          { title: 'Muay Femur', sub: 'technician', color: '#F5A524' }
        ], 'muay thai fighter styles diagram'))
    ]
  },
  {
    id: 'taekwondo-basics',
    label: { th: 'เทควันโด: กติกาพื้นฐาน', en: 'Taekwondo: Basic Rules' },
    group: { th: 'เทควันโด', en: 'Taekwondo' },
    items: [
      readingItem('รู้จักเทควันโด', 'Meet Taekwondo',
        [
          'เทควันโด (Taekwondo) เป็นศิลปะการต่อสู้จากเกาหลี บรรจุเป็นกีฬาโอลิมปิกอย่างเป็นทางการตั้งแต่ปี 2000 จุดเด่นคือเน้นเทคนิคการเตะเป็นหลัก (ให้คะแนนสูงกว่าหมัด) ต่างจากศิลปะการต่อสู้แบบผสมอื่นๆ',
          'การแข่งขันตามกติกาโอลิมปิก (World Taekwondo) แบ่งเป็น 3 ยก ยกละ 2 นาที พักระหว่างยก 1 นาที',
          "ผลการแข่งขันตัดสินจากคะแนนเมื่อครบเวลา, การน็อกเอาต์ (Knockout), หรือกรรมการยุติการแข่งขัน (RSC — Referee Stops Contest) เมื่อนักกีฬาฝ่ายหนึ่งไม่สามารถป้องกันตัวต่อได้อย่างปลอดภัย"
        ],
        [
          'Taekwondo is a Korean martial art that has been an official Olympic sport since 2000. Its defining feature is a heavy emphasis on kicking techniques, which score higher than punches — unlike many other combat sports.',
          'Under Olympic (World Taekwondo) rules, a match has 3 rounds of 2 minutes each, with a 1-minute rest between rounds.',
          'The outcome is decided by points when time runs out, by Knockout, or by a referee stoppage (RSC — Referee Stops Contest) when a competitor can no longer defend themselves safely.'
        ],
        svgFactStrip([
          { title: 'Olympic since 2000', sub: 'Korean martial art', color: '#1971C2' },
          { title: '3 x 2 min', sub: 'rounds', color: '#1971C2' },
          { title: 'Kicks Score Higher', sub: 'than punches', color: '#E8590C' }
        ], 'taekwondo match facts diagram')),
      readingItem('การให้คะแนน', 'Scoring System',
        [
          "เทควันโดระดับแข่งขันใช้ระบบให้คะแนนอิเล็กทรอนิกส์ (PSS — Protector and Scoring System) เซนเซอร์ที่ฝังอยู่ในเสื้อเกราะป้องกันตัว (Hogu) และหมวกกันน็อกจะตรวจจับแรงกระแทกและตัดสินว่าการเตะ/ต่อยนั้นได้คะแนนหรือไม่โดยอัตโนมัติ",
          'คะแนนแบ่งตามความยากของท่า: เตะลำตัวธรรมดา = 2 คะแนน, หมัดลำตัว = 1 คะแนน, เตะลำตัวแบบหมุนตัว (Turning/Spinning Kick) = 4 คะแนน, เตะศีรษะ = 3 คะแนน, เตะศีรษะแบบหมุนตัว = 5 คะแนน — ยิ่งท่ายากและเสี่ยงมาก ยิ่งได้คะแนนสูง',
          'การทำผิดกติกา (Gam-jeom) เช่น ล้มลงเอง ออกนอกสนามแข่ง จับหรือดึงตัวคู่ต่อสู้ เตะต่ำกว่าเอว หรือหันหลังให้คู่ต่อสู้ จะถูกตัดคะแนน 1 แต้มต่อครั้ง'
        ],
        [
          "Competitive Taekwondo uses an electronic scoring system (PSS — Protector and Scoring System). Sensors built into the body protector (Hogu) and headgear detect impact force and automatically determine whether a kick or punch scores.",
          'Points scale with the difficulty of the technique: a basic body kick = 2 points, a punch to the body = 1 point, a turning/spinning kick to the body = 4 points, a head kick = 3 points, and a turning/spinning kick to the head = 5 points — the harder and riskier the technique, the more it\'s worth.',
          'Rule violations (Gam-jeom) — such as falling down, stepping out of bounds, grabbing or holding the opponent, kicking below the waist, or turning your back to the opponent — cost 1 point deduction each.'
        ],
        svgFactStrip([
          { title: '2 pts', sub: 'body kick', color: '#1971C2' },
          { title: '3 pts', sub: 'head kick', color: '#E8590C' },
          { title: '4-5 pts', sub: 'spinning kicks', color: '#C92A2A' }
        ], 'taekwondo scoring points diagram')),
      readingItem('เขตคะแนนและเสื้อเกราะ', 'Scoring Zones & Protective Gear',
        [
          'เป้าที่ให้คะแนนได้มีเพียง 2 ส่วนเท่านั้น: ลำตัวในเขตที่เสื้อเกราะ (Hogu) คลุมอยู่ และศีรษะทั้งหมด — การโจมตีที่แขน ขา หรือแผ่นหลังต่ำกว่าเอวจะไม่นับคะแนนแม้จะโดนก็ตาม',
          "อุปกรณ์ป้องกันภาคบังคับสำหรับการแข่งขันมี: เสื้อเกราะ (Hogu), หมวกกันน็อก, สนับป้องกันแขนและหน้าแข้ง, สนับป้องกันเป้า และฟันยาง — ครบทุกชิ้นก่อนขึ้นชกเสมอ",
          "แม้เทควันโดจะเน้นเทคนิคเตะสูงและซับซ้อน แต่การเตะที่โดนเป้าแบบ 'ควบคุมได้' และมีแรงกระแทกผ่านเกณฑ์ที่เซนเซอร์กำหนดเท่านั้นที่จะได้คะแนน ไม่ใช่แค่สัมผัสเบาๆ"
        ],
        [
          "Only two areas count as valid scoring targets: the torso area covered by the Hogu, and the head — strikes to the arms, legs, or the back below the waist don't score even if they land.",
          'Mandatory protective gear for competition includes: the Hogu (body protector), headgear, forearm and shin guards, a groin guard, and a mouthguard — all required before stepping into the ring.',
          "Even though Taekwondo emphasizes high, complex kicks, only a controlled strike that lands on a valid target with force above the sensor's threshold scores a point — a light graze isn't enough."
        ],
        svgFactStrip([
          { title: 'Torso + Head', sub: 'only valid targets', color: '#1971C2' },
          { title: 'Hogu + Headgear', sub: 'required gear', color: '#2F9E44' },
          { title: 'PSS Sensors', sub: 'auto-detect force', color: '#E8590C' }
        ], 'taekwondo scoring zones and gear diagram')),
      readingItem('ท่าเตะพื้นฐาน', 'Basic Kicks',
        [
          "Ap Chagi (เตะตรง / Front Kick): เตะพุ่งตรงไปข้างหน้าด้วยปลายเท้าหรือฝ่าเท้า เป็นท่าเตะพื้นฐานที่สุด ใช้ทั้งโจมตีและควบคุมระยะ",
          'Dollyo Chagi (เตะเฉียง / Roundhouse Kick): ท่าเตะที่ใช้บ่อยที่สุดในการแข่งขัน หมุนสะโพกแล้วเตะด้วยหลังเท้าหรือหน้าแข้ง เป็นท่าทำคะแนนหลักของนักกีฬาส่วนใหญ่',
          'Yeop Chagi (เตะข้าง / Side Kick): เตะพุ่งไปด้านข้างด้วยสันเท้าหรือส้นเท้า งอเข่าตั้งท่าก่อนแล้วยืดขาพุ่งออกไป เป็นท่าที่ทรงพลังมากเพราะใช้แรงจากสะโพกเต็มที่',
          'Dwit Chagi (เตะกลับหลัง / Back Kick หรือ Spinning Kick): หมุนตัวหันหลังให้คู่ต่อสู้ชั่วขณะแล้วพุ่งเตะกลับไปด้านหลัง เป็นท่าที่ทรงพลังที่สุดแต่ต้องอาศัยจังหวะและการทรงตัวที่ดี'
        ],
        [
          'Ap Chagi (Front Kick): a straight kick thrust forward using the ball or sole of the foot — the most basic kick, used both to attack and to control distance.',
          'Dollyo Chagi (Roundhouse Kick): the most commonly used scoring kick in competition, rotating the hip and striking with the instep or shin — the primary scoring technique for most competitors.',
          'Yeop Chagi (Side Kick): a powerful thrusting kick to the side using the blade or heel of the foot, chambering the knee first before extending the leg out — very powerful because it uses full hip drive.',
          'Dwit Chagi (Back Kick / Spinning Kick): the fighter briefly turns their back to the opponent before thrusting the kick backward — the most powerful kick, but requiring excellent timing and balance.'
        ],
        svgFactStrip([
          { title: 'Ap Chagi', sub: 'front kick', color: '#1971C2' },
          { title: 'Dollyo Chagi', sub: 'roundhouse, most used', color: '#E8590C' },
          { title: 'Yeop Chagi', sub: 'side kick', color: '#2F9E44' },
          { title: 'Dwit Chagi', sub: 'spinning back kick', color: '#C92A2A' }
        ], 'taekwondo basic kicks diagram')),
      readingItem('แถบสี (Belt Ranks) และปรัชญา', 'Belt Ranks & Philosophy',
        [
          'ระบบสายคาดเอว (Geup/Kup) ไล่ระดับจากสายขาวไปจนถึงสายดำ (Dan) จำนวนระดับ Geup อาจต่างกันไปตามสำนัก/สหพันธ์ แต่ที่พบบ่อยคือ 10 กึบลงมาจนถึง 1 กึบ ก่อนขึ้นเป็นสายดำ',
          'หลักธรรม 5 ประการของเทควันโด (Five Tenets): มารยาท (Courtesy/Ye Ui), ความซื่อสัตย์ (Integrity/Yom Chi), ความอดทน (Perseverance/In Nae), การควบคุมตนเอง (Self-Control/Guk Gi), และจิตใจที่ไม่ย่อท้อ (Indomitable Spirit/Baekjul Boolgool)',
          'พุมเซ่ (Poomsae) คือชุดท่าเทคนิคที่ร่ายรำต่อเนื่องกันคนเดียว (คล้ายคาตะในคาราเต้) ใช้ทั้งฝึกพื้นฐานท่าทางและเป็นประเภทการแข่งขันแยกต่างหากจากการต่อสู้จริง (Kyorugi)'
        ],
        [
          'The colored belt system (Geup/Kup) progresses from white belt up to black belt (Dan). The number of Geup levels varies by school or federation, but a common system runs from 10th Geup down to 1st Geup before reaching black belt.',
          'The Five Tenets of Taekwondo are: Courtesy (Ye Ui), Integrity (Yom Chi), Perseverance (In Nae), Self-Control (Guk Gi), and Indomitable Spirit (Baekjul Boolgool).',
          'Poomsae (Forms/Patterns) are choreographed solo sequences of techniques (similar to kata in karate), used both to train fundamentals and as a separate competitive discipline from actual sparring (Kyorugi).'
        ],
        svgFactStrip([
          { title: 'White → Black', sub: 'Geup to Dan', color: '#1971C2' },
          { title: '5 Tenets', sub: 'courtesy, integrity...', color: '#F5A524' },
          { title: 'Poomsae', sub: 'solo forms practice', color: '#2F9E44' }
        ], 'taekwondo belt ranks and philosophy diagram')),
      readingItem('เทคนิคขั้นสูง: การหลอกล่อและการเตะต่อเนื่อง', 'Advanced Tactics: Feinting & Combination Kicks',
        [
          'การหลอกล่อ (Feinting): ใช้การขยับเท้าหรือลำตัวหลอกให้คู่ต่อสู้ตอบสนองผิดจังหวะ เช่น ยกเข่าเสมือนจะเตะแต่ไม่เตะจริง เพื่อดึงการ์ดคู่ต่อสู้ให้เปิดก่อนออกท่าจริง',
          'การเตะกระโดดปิดระยะ (Skip Kick): ใช้เท้าหลังกระโดดสับเปลี่ยนตำแหน่งกับเท้าหน้าอย่างรวดเร็วเพื่อปิดระยะห่างก่อนเตะ ทำให้เตะได้เร็วและแรงขึ้นโดยคู่ต่อสู้ตั้งตัวไม่ทัน',
          'การเตะต่อเนื่อง (Combination Kicks): เช่น เตะเฉียงซ้ำสองครั้งติดกันคนละขา หรือเตะเฉียงตามด้วยเตะหมุนกลับหลัง ยิ่งเตะต่อเนื่องซับซ้อนและแม่นยำเท่าไหร่ ยิ่งมีโอกาสได้คะแนนสูงเพราะระบบให้คะแนนสนับสนุนท่ายาก',
          'ระบบให้คะแนนของเทควันโดให้รางวัลกับการสวนกลับ (Counter-Attack) หลังจากตั้งรับสำเร็จ เพราะแสดงถึงการอ่านเกมและจังหวะที่ดี นักกีฬาระดับสูงจึงมักรอให้คู่ต่อสู้เปิดเกมก่อนแล้วจึงสวนกลับ แทนที่จะรุกใส่ตลอดเวลา'
        ],
        [
          "Feinting: using foot or body movement to trick the opponent into reacting at the wrong moment — for example, raising the knee as if about to kick without actually kicking, to draw the opponent's guard open before the real technique.",
          'The Skip Kick: quickly swapping the back and front foot positions with a small hop to close the distance before kicking, making the kick faster and more powerful while catching the opponent off guard.',
          'Combination Kicks: for example, two consecutive roundhouse kicks off alternating legs, or a roundhouse kick followed by a spinning back kick. The more complex and accurate the combination, the higher the scoring potential, since the scoring system rewards difficult techniques.',
          "Taekwondo's scoring system rewards counter-attacking after a successful defense, since it demonstrates good game-reading and timing. High-level competitors often wait for the opponent to commit first, then counter, rather than attacking constantly."
        ],
        svgFlowSteps([
          { title: 'Feint', sub: 'fake to open guard', color: '#1971C2' },
          { title: 'Skip', sub: 'close distance fast', color: '#2F9E44' },
          { title: 'Combo Kick', sub: 'chain techniques', color: '#E8590C' }
        ], 'taekwondo advanced tactics flow diagram')),
      readingItem('ประเภทการแข่งขัน: Kyorugi กับ Poomsae', 'Competition Disciplines: Kyorugi vs Poomsae',
        [
          'Kyorugi (คิวรูกิ) คือการต่อสู้จริงแบบเต็มรูปแบบที่กล่าวถึงในบทเรียนก่อนหน้า ใช้ระบบให้คะแนนอิเล็กทรอนิกส์ แบ่งรุ่นน้ำหนัก (Weight Class) เพื่อให้คู่แข่งขันมีความได้เปรียบทางร่างกายใกล้เคียงกัน',
          'Poomsae (พุมเซ่) คือการแข่งขันร่ายรำท่าเทคนิคคนเดียวตามแบบแผนที่กำหนดไว้ล่วงหน้า ไม่มีการปะทะกับคู่ต่อสู้จริง จึงไม่มีการแบ่งรุ่นน้ำหนัก แต่แบ่งตามระดับสายหรืออายุแทน',
          'เกณฑ์การให้คะแนน Poomsae แบ่งเป็น 2 ส่วน: ความแม่นยำ (Accuracy) เช่น ท่ายืน ทิศทาง และเทคนิคตรงตามแบบแผนหรือไม่ และการนำเสนอ (Presentation) เช่น พลัง จังหวะความเร็ว และการควบคุมลมหายใจ',
          'ทั้ง Kyorugi และ Poomsae เป็นประเภทการแข่งขันที่ได้รับการยอมรับแยกจากกันในระดับนานาชาติ นักกีฬาบางคนเลือกฝึกเฉพาะทางใดทางหนึ่ง ขณะที่บางคนแข่งทั้งสองประเภท เพราะทักษะพื้นฐาน (ท่าเตะ ท่ายืน) เป็นรากฐานร่วมกัน'
        ],
        [
          'Kyorugi is the full-contact sparring discipline covered in the previous lesson, using the electronic scoring system, with competitors divided into weight classes to keep physical advantages fair.',
          'Poomsae is a solo forms competition performing a pre-set pattern of techniques, with no actual contact against an opponent — so there are no weight classes, only divisions by belt rank or age.',
          'Poomsae is judged on two criteria: Accuracy (whether stances, directions, and techniques match the prescribed pattern) and Presentation (power, rhythm/speed, and breath control).',
          'Both Kyorugi and Poomsae are recognized as separate competitive disciplines internationally. Some athletes specialize in just one, while others compete in both, since the fundamental skills (kicks, stances) form a shared foundation.'
        ],
        svgFactStrip([
          { title: 'Kyorugi', sub: 'full-contact sparring', color: '#E8590C' },
          { title: 'Poomsae', sub: 'solo forms, judged', color: '#2F9E44' }
        ], 'taekwondo kyorugi vs poomsae diagram'))
    ]
  },
  {
    id: 'boxing-basics',
    label: { th: 'มวยสากล: กติกาพื้นฐาน', en: 'Boxing: Basic Rules' },
    group: { th: 'มวยสากล', en: 'Boxing' },
    items: [
      readingItem('รู้จักมวยสากล', 'Meet Boxing',
        [
          'มวยสากล (Boxing) เป็นกีฬาต่อสู้ที่ใช้เพียงหมัดเท่านั้น (ไม่มีเตะ ศอก หรือเข่า) สวมนวมป้องกันมือ เป้าที่ชกได้คือศีรษะและลำตัวด้านหน้า/ด้านข้างเท่านั้น',
          'การแข่งขันสมัครเล่น/โอลิมปิกมี 3 ยก ยกละ 3 นาที ส่วนมวยอาชีพอาจยาวถึง 12 ยก ยกละ 3 นาที (แล้วแต่รุ่นและความสำคัญของแมตช์) พักระหว่างยก 1 นาที',
          "ผลการแข่งขันตัดสินได้จาก: น็อกเอาต์ (KO), กรรมการ/แพทย์ยุติการชก (TKO — Technical Knockout เช่น มุมเลือดยอมแพ้แทนนักมวย หรือบาดแผลรุนแรงเกินจะชกต่อ), หรือให้คะแนนจากกรรมการ (Judges' Decision) เมื่อครบยก"
        ],
        [
          'Boxing is a combat sport using fists only (no kicks, elbows, or knees), with padded gloves worn for protection. Valid targets are the head and the front/sides of the torso only.',
          "Amateur/Olympic matches have 3 rounds of 3 minutes each. Professional matches can run up to 12 rounds of 3 minutes (depending on weight class and the fight's significance), with a 1-minute rest between rounds.",
          "The outcome can be decided by: Knockout (KO), a referee/doctor stoppage (TKO — Technical Knockout, e.g. a fighter's corner throwing in the towel, or an injury too severe to continue safely), or a Judges' Decision on points when the fight goes the distance."
        ],
        svgFactStrip([
          { title: 'Fists Only', sub: 'no kicks/elbows/knees', color: '#1971C2' },
          { title: '3-12 rounds', sub: 'x 3 min', color: '#1971C2' },
          { title: 'KO / TKO / Decision', sub: '3 ways to win', color: '#E8590C' }
        ], 'boxing match facts diagram')),
      readingItem('การให้คะแนนและการชนะ', 'Scoring & Winning',
        [
          "ระบบให้คะแนนมาตรฐาน (10-Point Must System): ผู้ชนะในแต่ละยกได้ 10 คะแนน ผู้แพ้ได้ 9 คะแนนหรือน้อยกว่า (เช่น 8 คะแนนถ้าโดนล้มในยกนั้น) กรรมการให้คะแนนทุกยกแล้วรวมผลตอนจบแมตช์",
          "การนับ 8 (Standing 8-Count / Mandatory 8-Count): กรรมการนับถึง 8 หลังนักมวยถูกล้มหรือมึนงงจากการโดนชก ถ้านักมวยไม่สามารถแสดงให้เห็นว่าพร้อมชกต่อได้เมื่อนับถึง 8 การชกจะถูกยุติทันที",
          "TKO อาจเกิดขึ้นได้เช่นกันถ้าใบหน้านักมวยฉีกขาดรุนแรงเกินกว่าจะชกต่อได้อย่างปลอดภัย หรือถ้ามุมพี่เลี้ยงนักมวยโยนผ้าเข้าสังเวียนเพื่อยอมแพ้แทนนักมวยของตัวเอง"
        ],
        [
          'The standard scoring system (10-Point Must System): the winner of each round gets 10 points, the loser gets 9 or fewer (e.g. 8 if they were knocked down that round). Judges score every round and total the results at the end of the match.',
          "The Standing 8-Count (Mandatory 8-Count): the referee counts to 8 after a fighter is knocked down or dazed from a punch. If the fighter can't demonstrate they're fit to continue by the count of 8, the fight is stopped immediately.",
          "A TKO can also happen if a fighter's face is cut too badly to continue safely, or if their corner throws in the towel to concede on their behalf."
        ],
        svgFactStrip([
          { title: '10-Point Must', sub: 'winner gets 10', color: '#1971C2' },
          { title: '8-Count', sub: 'after a knockdown', color: '#E8590C' },
          { title: 'TKO', sub: 'ref/corner stoppage', color: '#C92A2A' }
        ], 'boxing scoring and winning facts diagram')),
      readingItem('หมัดพื้นฐาน 4 แบบ', '4 Basic Punches',
        [
          'Jab: หมัดตรงเร็วจากมือหน้า ใช้วัดระยะและเปิดทางให้หมัดชุดถัดไป เป็นหมัดที่พลังน้อยที่สุดแต่ใช้บ่อยที่สุด ดูไดอะแกรมด้านล่างประกอบ',
          'Cross (หมัดตรงหลัง): หมัดตรงพลังสูงจากมือหลัง หมุนสะโพกและไหล่ส่งแรงเต็มที่ เป็นหมัดจบสกอร์ที่ใช้บ่อยที่สุด',
          'Hook: หมัดที่เหวี่ยงเป็นแนวโค้งแนวนอน เป้าหมายคือด้านข้างศีรษะหรือลำตัว งอศอกประมาณ 90 องศาขณะเหวี่ยง',
          'Uppercut: หมัดที่พุ่งขึ้นในแนวดิ่ง เป้าหมายคือคางหรือลำตัว สร้างแรงจากการงอเข่าแล้วดันตัวขึ้น'
        ],
        [
          'Jab: a fast straight punch from the lead hand, used to gauge distance and set up the next combination — the least powerful punch but the most frequently thrown. See the diagram below.',
          'Cross (rear straight punch): a powerful straight punch from the rear hand, rotating the hip and shoulder through for full power — the most commonly used punch to finish a combination.',
          'Hook: a punch thrown in a horizontal arc, targeting the side of the head or the body, with the elbow bent roughly 90 degrees during the swing.',
          'Uppercut: a punch thrown vertically upward, targeting the chin or the body, generated by bending the knees and driving upward.'
        ],
        buildBoxingPunchAnglesSvg()),
      readingItem('การป้องกันตัว: การ์ด การหลบ และฟุตเวิร์ก', 'Defense: Guard, Slip & Footwork',
        [
          'ท่าการ์ดพื้นฐาน (Guard): ยกมือทั้งสองข้างป้องกันคาง เก็บคางลง และหุบศอกเข้าเพื่อป้องกันลำตัว เป็นท่าเริ่มต้นก่อนทุกการเคลื่อนไหว',
          'การหลบ (Slip): ขยับศีรษะออกจากแนวกึ่งกลางลำตัวเพื่อหลบหมัดตรงโดยไม่ต้องขยับเท้ามาก เป็นทักษะป้องกันที่ประหยัดพลังงานที่สุด',
          'การบล็อก/ปัด (Block/Parry): ใช้นวมหรือปลายแขนรับแรงหรือปัดทิศทางหมัดที่พุ่งเข้ามา',
          'ฟุตเวิร์ก (Footwork): รักษาสมดุลและความคล่องตัว ห้ามไขว้เท้าขณะเคลื่อนที่ ใช้ควบคุมระยะและมุมแทนที่จะยืนแลกหมัดตรงๆ อย่างเดียว'
        ],
        [
          'The basic Guard: both hands raised protecting the chin, chin tucked down, elbows in to protect the body — the starting position before every movement.',
          "Slip: moving the head off the body's centerline to dodge a straight punch without moving the feet much — the most energy-efficient defensive skill.",
          'Block/Parry: using the gloves or forearms to absorb impact or deflect the direction of an incoming punch.',
          'Footwork: staying balanced and mobile, never crossing the feet while moving, using it to control range and angle rather than just standing and trading punches.'
        ],
        svgFactStrip([
          { title: 'Guard', sub: 'hands up, chin down', color: '#1971C2' },
          { title: 'Slip', sub: 'move head off-line', color: '#2F9E44' },
          { title: 'Footwork', sub: 'never cross feet', color: '#E8590C' }
        ], 'boxing defense facts diagram')),
      readingItem('รุ่นน้ำหนัก', 'Weight Classes',
        [
          'มวยสากลแบ่งรุ่นน้ำหนักหลายรุ่น (เช่น ฟลายเวท เฟเธอร์เวท ไลท์เวท เวลเตอร์เวท มิดเดิลเวท เฮฟวี่เวท ฯลฯ) เพื่อให้คู่ชกมีความได้เปรียบทางร่างกายใกล้เคียงกัน เพราะน้ำหนักมีผลต่อพลังหมัดอย่างมาก',
          'การชั่งน้ำหนัก (Weigh-in) ในมวยอาชีพมักจัดขึ้นหนึ่งวันก่อนการชก นักมวยต้องทำน้ำหนักให้อยู่ในเกณฑ์รุ่นของตัวเอง ไม่งั้นอาจถูกปรับหรือยกเลิกการชกได้',
          'มวยสมัครเล่นมักสวมหมวกป้องกันศีรษะ (ในบางรุ่น) และมีกติกาการให้คะแนน/ความปลอดภัยที่ต่างจากมวยอาชีพเล็กน้อย'
        ],
        [
          'Boxing is divided into many weight classes (e.g. Flyweight, Featherweight, Lightweight, Welterweight, Middleweight, Heavyweight, etc.) to keep physical advantages fair between opponents, since weight strongly affects punching power.',
          'A professional Weigh-in is usually held one day before the fight. Fighters must make weight for their class, or risk penalties or the fight being cancelled.',
          'Amateur boxing often uses headgear (in some categories) and has slightly different scoring and safety rules compared to professional boxing.'
        ],
        svgFactStrip([
          { title: 'Flyweight → Heavyweight', sub: 'many weight classes', color: '#1971C2' },
          { title: 'Weigh-in', sub: 'day before pro fights', color: '#2F9E44' }
        ], 'boxing weight classes diagram')),
      readingItem('กลยุทธ์: การชกต่อเนื่องและการควบคุมพื้นที่บนเวที', 'Strategy: Combination Punching & Ring Generalship',
        [
          'การชกต่อเนื่อง (Combination Punching) คือการชกหลายหมัดติดต่อกันในจังหวะเดียว เช่น Jab-Cross-Hook (1-2-3) เพื่อให้คู่ต่อสู้ป้องกันไม่ทันครบทุกหมัด ยิ่งชุดหมัดหลากหลายมุมเท่าไหร่ ยิ่งเจาะการ์ดคู่ต่อสู้ได้ง่ายขึ้น',
          'การควบคุมพื้นที่บนเวที (Ring Generalship) คือทักษะการบังคับให้คู่ต่อสู้เคลื่อนที่ไปในทิศทางที่ตัวเองต้องการ เช่น การตัดมุมเวที (Cutting Off the Ring) ไล่ต้อนคู่ต่อสู้ไปติดเชือกจนไม่มีที่หนี',
          'ท่ายืนถนัดขวา (Orthodox) กับถนัดซ้าย (Southpaw) มักสร้างปัญหาให้กันเอง เพราะมุมการชกและตำแหน่งเท้าตรงข้ามกัน นักมวยที่ไม่คุ้นชินการชกกับฝ่ายตรงข้ามสไตล์มักเสียเปรียบในช่วงต้นไฟต์',
          'การอ่านจังหวะการหายใจและการก้าวเท้าของคู่ต่อสู้ ช่วยให้ทำนายได้ว่าคู่ต่อสู้กำลังจะออกหมัดหรือกำลังจะถอย ทำให้วางแผนสวนกลับหรือรุกได้แม่นยำขึ้น'
        ],
        [
          "Combination Punching is throwing several punches in one continuous sequence, such as Jab-Cross-Hook (1-2-3), so the opponent can't defend against every punch in time. The more varied the angles in a combination, the easier it breaks through the opponent's guard.",
          'Ring Generalship is the skill of forcing the opponent to move where you want them to — for example, Cutting Off the Ring, herding the opponent toward the ropes until they have nowhere left to escape.',
          'Orthodox (right-handed lead) and Southpaw (left-handed lead) stances often cause problems for each other, since their punching angles and foot positions are mirror-opposite. A fighter unfamiliar with the opposite stance is often at a disadvantage early in the fight.',
          "Reading an opponent's breathing rhythm and footwork helps predict whether they're about to punch or retreat, allowing more accurate counters or attacks."
        ],
        svgFlowSteps([
          { title: 'Jab', sub: 'set up', color: '#1971C2' },
          { title: 'Cross', sub: 'power', color: '#2F9E44' },
          { title: 'Hook', sub: 'finish', color: '#E8590C' }
        ], 'boxing combination punching sequence diagram')),
      readingItem('เทคนิคขั้นสูง: การล็อกตัว หมัดสวน และการชกลำตัว', 'Advanced Techniques: Clinching, Counter-Punching & Body Shots',
        [
          'การล็อกตัว (Clinching) ในมวยสากลต่างจากมวยไทยตรงที่ห้ามชกขณะล็อกตัวอยู่ กรรมการจะแยกคู่ชกออกจากกันทันทีเมื่อเข้าล็อกตัว มักใช้เพื่อพักหรือขัดจังหวะโมเมนตัมของคู่ต่อสู้เท่านั้น',
          'หมัดสวน (Counter-Punching) คือการรอให้คู่ต่อสู้ออกหมัดก่อนแล้วจึงชกสวนกลับในจังหวะที่คู่ต่อสู้เปิดช่องว่าง นักมวยสายสวน (Counter-Puncher) มักใช้พลังงานน้อยกว่าแต่ต้องมีปฏิกิริยาตอบสนองที่แม่นยำมาก',
          "การชกลำตัว (Body Shots) มักถูกมองข้ามเพราะไม่ทำให้น็อกทันทีเหมือนชกหน้า แต่สะสมความเสียหายและบั่นทอนพละกำลังคู่ต่อสู้ในยกท้ายๆ ได้ดีมาก มีคำกล่าวในวงการมวยว่า 'Body shots pay the bills' หมายถึงเป็นการลงทุนระยะยาวที่ได้ผลจริง",
          'การผสมผสานทั้งสามทักษะ (ล็อกตัวเพื่อพัก, สวนกลับแม่นยำ, ชกลำตัวสะสมความเสียหาย) เข้าด้วยกันอย่างเหมาะสมตามสถานการณ์ในแต่ละยก คือสิ่งที่แยกนักมวยระดับสูงออกจากนักมวยทั่วไป'
        ],
        [
          "Clinching in boxing differs from Muay Thai in that striking is not allowed while clinched — the referee breaks the fighters apart immediately. It's used mainly to rest or to disrupt the opponent's momentum, not to strike.",
          'Counter-Punching means waiting for the opponent to throw first, then striking back the instant they open a gap. Counter-punchers typically expend less energy but need very sharp reflexes.',
          "Body Shots are often overlooked since they rarely produce an instant knockout like a head shot, but they accumulate damage and drain the opponent's stamina effectively in later rounds. There's a saying in boxing: 'Body shots pay the bills' — meaning it's a long-term investment that really pays off.",
          'Blending all three skills — clinching to rest, precise counter-punching, and body shots to accumulate damage — appropriately for each round\'s situation is what separates elite boxers from ordinary ones.'
        ],
        svgFactStrip([
          { title: 'Clinch', sub: 'no strikes allowed', color: '#1971C2' },
          { title: 'Counter-Punch', sub: "react, don't initiate", color: '#2F9E44' },
          { title: 'Body Shots', sub: 'wear down stamina', color: '#E8590C' }
        ], 'boxing advanced techniques diagram'))
    ]
  },
  {
    id: 'judo-basics',
    label: { th: 'ยูโด: กติกาพื้นฐาน', en: 'Judo: Basic Rules' },
    group: { th: 'ยูโด', en: 'Judo' },
    items: [
      readingItem('รู้จักยูโด', 'Meet Judo',
        [
          'ยูโด (Judo) เป็นศิลปะการต่อสู้จากญี่ปุ่น แปลว่า \'วิถีแห่งความอ่อนโยน\' ก่อตั้งโดยจิโกโร คาโนะ ในปี ค.ศ. 1882 บรรจุเป็นกีฬาโอลิมปิกตั้งแต่ปี 1964 (ประเภทชาย) และ 1992 (ประเภทหญิง)',
          "หลักปรัชญาหลักของยูโดคือ 'ใช้พลังงานให้เกิดประโยชน์สูงสุดด้วยความพยายามน้อยที่สุด' (Seiryoku Zenyo) และ 'ประโยชน์และสวัสดิภาพร่วมกัน' (Jita Kyoei) — เน้นเทคนิคและการใช้แรงคู่ต่อสู้มากกว่าความแข็งแรงอย่างเดียว",
          'การแข่งขันตามกติกาสากล/โอลิมปิก มีเวลาแข่งขันมาตรฐาน 4 นาที ถ้าจบเวลาโดยไม่มีใครทำ Ippon (ชนะเด็ดขาด) จะเข้าสู่ช่วงต่อเวลา (Golden Score) แบบตายก่อนแพ้ก่อน (Sudden Death)'
        ],
        [
          "Judo is a Japanese martial art whose name means 'the gentle way'. It was founded by Jigoro Kano in 1882, and has been an Olympic sport since 1964 (men) and 1992 (women).",
          "Judo's core philosophy is 'Maximum efficiency, minimum effort' (Seiryoku Zenyo) and 'Mutual welfare and benefit' (Jita Kyoei) — emphasizing technique and using the opponent's own force over raw strength alone.",
          "Under international/Olympic rules, a match's standard contest time is 4 minutes. If no one scores an Ippon (an outright win) by time's up, the match goes to Golden Score — sudden-death overtime."
        ],
        svgFactStrip([
          { title: 'Founded 1882', sub: 'by Jigoro Kano', color: '#1971C2' },
          { title: 'Olympic since 1964', sub: 'men / 1992 women', color: '#1971C2' },
          { title: '4 min', sub: 'standard match time', color: '#2F9E44' }
        ], 'judo match facts diagram')),
      readingItem('การให้คะแนนและการชนะ', 'Scoring & Winning',
        [
          'Ippon (อิปปง) คือคะแนนเต็มที่ทำให้ชนะทันที ได้จาก: การทุ่มคู่ต่อสู้ลงหลังด้วยแรง ความเร็ว และการควบคุมที่สมบูรณ์, การจับล็อกกดคู่ต่อสู้ไว้กับพื้น (Osaekomi) นาน 20 วินาที, หรือคู่ต่อสู้ยอมแพ้จากการถูกรัดคอ/ล็อกข้อต่อ',
          'Waza-ari (วาซาอาริ) คือครึ่งคะแนน ให้เมื่อการทุ่มเกือบสมบูรณ์แบบแต่ขาดองค์ประกอบบางอย่างของ Ippon — ถ้าทำ Waza-ari ได้ 2 ครั้งในแมตช์เดียวกัน จะรวมเป็น Ippon ทันที (Waza-ari Awasete Ippon)',
          'ถ้าครบเวลาแข่งขันโดยไม่มีใครทำ Ippon จะตัดสินจาก Waza-ari ที่ทำได้มากกว่า ถ้ายังเสมอกันจะเข้าสู่ Golden Score ต่อเวลาแบบใครทำคะแนนได้ก่อนชนะทันที'
        ],
        [
          "Ippon is a full point that wins the match instantly, earned by: throwing the opponent onto their back with force, speed, and full control; pinning the opponent to the mat (Osaekomi) for 20 seconds; or the opponent submitting from a choke or joint lock.",
          "Waza-ari is a half-point, awarded for a throw that's nearly perfect but missing one element of a full Ippon — scoring two Waza-ari in the same match combines into an automatic Ippon (Waza-ari Awasete Ippon).",
          'If time runs out with no Ippon scored, the win goes to whoever has more Waza-ari. If still tied, the match goes to Golden Score — sudden-death overtime where the next score wins immediately.'
        ],
        svgFactStrip([
          { title: 'Ippon', sub: 'instant win', color: '#E8590C' },
          { title: 'Waza-ari', sub: 'half point, x2 = Ippon', color: '#1971C2' },
          { title: 'Golden Score', sub: 'sudden death OT', color: '#F5A524' }
        ], 'judo scoring facts diagram')),
      readingItem('การทุ่มพื้นฐาน (Nage-waza)', 'Basic Throws (Nage-waza)',
        [
          'การจับคู่ต่อสู้ (Kumi-kata) คือการควบคุมชุดยูโด (Judogi) ของคู่ต่อสู้ เป็นรากฐานของการทุ่มทุกท่า — นักยูโดระดับสูงมักแย่งชิงตำแหน่งจับที่ได้เปรียบก่อนจะเริ่มโจมตีจริง',
          'O Goshi (ทุ่มสะโพกใหญ่): ดึงคู่ต่อสู้ให้พาดบนสะโพกตัวเอง แล้วหมุนตัวเหวี่ยงทุ่มข้ามสะโพกลงพื้น เป็นท่าทุ่มพื้นฐานที่สุดที่นักยูโดทุกคนต้องฝึกเป็นอันดับแรก',
          'Seoi Nage (ทุ่มพาดบ่า): ดึงคู่ต่อสู้ให้พาดบนหลัง/บ่าตัวเอง แล้วก้มตัวเหวี่ยงทุ่มไปข้างหน้า เป็นท่าที่นิยมมากในระดับแข่งขันเพราะทำ Ippon ได้บ่อย',
          'Ouchi Gari / Osoto Gari (เกี่ยวขาด้านใน/ด้านนอก): ใช้ขาเกี่ยว/กวาดขาคู่ต่อสู้เพื่อทำลายการทรงตัวแล้วทุ่มลงพื้น ไม่ต้องใช้แรงยกมากเท่าท่าทุ่มสะโพก/บ่า เหมาะกับผู้เริ่มต้น'
        ],
        [
          "Grip Fighting (Kumi-kata) — controlling the opponent's judogi (uniform) — is the foundation of every throw. High-level judoka often fight hard for an advantageous grip before ever attempting a real attack.",
          'O Goshi (Major Hip Throw): pull the opponent onto your hip, then rotate and swing them over and down. It\'s the most fundamental throw that every judoka learns first.',
          'Seoi Nage (Shoulder Throw): pull the opponent onto your back/shoulder, then bend forward and throw them forward. It\'s very popular in competition because it frequently scores Ippon.',
          'Ouchi Gari / Osoto Gari (Inner/Outer Reap): using the leg to reap or sweep the opponent\'s leg to break their balance and take them down. It requires less lifting strength than hip or shoulder throws, making it a good technique for beginners.'
        ],
        svgFactStrip([
          { title: 'O Goshi', sub: 'hip throw', color: '#1971C2' },
          { title: 'Seoi Nage', sub: 'shoulder throw', color: '#2F9E44' },
          { title: 'Ouchi/Osoto Gari', sub: 'leg reap', color: '#E8590C' }
        ], 'judo basic throws diagram')),
      readingItem('เทคนิคพื้นสนาม (Ne-waza)', 'Ground Techniques (Ne-waza)',
        [
          'Osaekomi-waza (การจับกด): เทคนิคกดคู่ต่อสู้ให้แผ่นหลังติดพื้นและควบคุมไว้ไม่ให้หลุด นาน 20 วินาทีเพื่อให้ได้ Ippon (บางกติการะดับล่างใช้เวลาสั้นกว่านี้)',
          'Shime-waza (การรัดคอ): ใช้แขนหรือชุดยูโดของคู่ต่อสู้รัดคอเพื่อบีบหลอดเลือดหรือทางเดินหายใจ ถ้าคู่ต่อสู้ตบพื้นยอมแพ้ (Tap Out) จะได้ Ippon ทันที เป็นเทคนิคที่ต้องระวังความปลอดภัยสูงมาก',
          'Kansetsu-waza (การล็อกข้อต่อ): กติกาการแข่งขันยูโดอนุญาตเฉพาะการล็อกข้อศอก (Armbar) เท่านั้น ห้ามล็อกข้อต่ออื่นๆ เช่น เข่า ข้อมือ หรือกระดูกสันหลัง เพื่อความปลอดภัยของนักกีฬา'
        ],
        [
          'Osaekomi-waza (Pins/Holds): pinning the opponent\'s back to the mat and maintaining control without them escaping, for 20 seconds to score an Ippon (some lower-level rulesets use a shorter time).',
          'Shime-waza (Chokes): using an arm or the opponent\'s own judogi to compress the blood vessels or airway in the neck. If the opponent taps out to submit, it\'s an immediate Ippon — a technique that demands serious attention to safety.',
          'Kansetsu-waza (Joint Locks): competition rules only permit elbow locks (armbars). Locks on any other joint — knees, wrists, or the spine — are prohibited for athlete safety.'
        ],
        svgFactStrip([
          { title: 'Osaekomi', sub: 'pin, 20 sec = Ippon', color: '#1971C2' },
          { title: 'Shime-waza', sub: 'chokes', color: '#E8590C' },
          { title: 'Kansetsu-waza', sub: 'elbow locks only', color: '#C92A2A' }
        ], 'judo ground techniques diagram')),
      readingItem('มารยาทและระบบสายคาดเอว', 'Etiquette & Belt System',
        [
          'การโค้งคำนับ (Rei) เป็นธรรมเนียมสำคัญของยูโด ทำก่อนและหลังการฝึกซ้อมหรือแข่งขันทุกครั้ง เพื่อแสดงความเคารพต่อคู่ฝึก/คู่แข่ง ต่อสถานที่ฝึก (Dojo) และต่อตัวกีฬาเอง — ถือเป็นหัวใจของปรัชญายูโดไม่แพ้เทคนิคการทุ่ม',
          'ระบบสายคาดเอวไล่ระดับจากขั้นต้น (Kyu) ไปจนถึงขั้นดำ (Dan) คล้ายศิลปะการต่อสู้ญี่ปุ่นอื่นๆ — สีสายแตกต่างกันไปตามสหพันธ์แต่ละประเทศ',
          'Randori คือการฝึกซ้อมแบบอิสระ (ไม่ใช่การแข่งขันจริง) ที่ทั้งสองฝ่ายพยายามทุ่ม/ล็อกกันด้วยความร่วมมือและการควบคุมความแรง เป็นวิธีหลักที่นักยูโดใช้พัฒนาเทคนิคกับคู่ฝึกที่ต่อต้านจริง'
        ],
        [
          'Bowing (Rei) is an essential Judo custom performed before and after every practice or match, showing respect for one\'s training partner/opponent, the training hall (Dojo), and the sport itself — considered as central to Judo\'s philosophy as its throwing techniques.',
          'The belt ranking system progresses from beginner grades (Kyu) up to black-belt grades (Dan), similar to other Japanese martial arts — belt colors vary somewhat between national federations.',
          'Randori is free, cooperative sparring practice (not a real competition) where both partners attempt throws and locks on each other with controlled intensity — the main way judoka develop technique against a genuinely resisting partner.'
        ],
        svgFactStrip([
          { title: 'Rei', sub: 'bow, show respect', color: '#F5A524' },
          { title: 'Kyu → Dan', sub: 'belt progression', color: '#1971C2' },
          { title: 'Randori', sub: 'free sparring practice', color: '#2F9E44' }
        ], 'judo etiquette and belt system diagram')),
      readingItem('ขั้นตอนของการทุ่ม: Kuzushi-Tsukuri-Kake', 'The 3 Phases of a Throw: Kuzushi-Tsukuri-Kake',
        [
          'ทุกการทุ่มในยูโดแบ่งเป็น 3 ขั้นตอนต่อเนื่องกัน: Kuzushi (การทำลายการทรงตัว) คือการดึง/ดันคู่ต่อสู้ให้เสียสมดุลก่อนโจมตี เพราะร่างกายมนุษย์ทุ่มยากมากถ้ายังทรงตัวมั่นคงอยู่ ดูไดอะแกรมด้านล่างประกอบ',
          'Tsukuri (การเข้าตำแหน่ง) คือการเคลื่อนตัวเข้าตำแหน่งที่เหมาะสมสำหรับท่าทุ่มที่เลือกไว้ ระหว่างที่คู่ต่อสู้ยังเสียสมดุลอยู่ ต้องทำเร็วก่อนคู่ต่อสู้ตั้งตัวได้ทัน',
          'Kake (การทุ่มจริง) คือขั้นตอนสุดท้าย การออกแรงทุ่มคู่ต่อสู้ลงพื้นให้สำเร็จ — นักยูโดระดับสูงจะทำทั้ง 3 ขั้นตอนนี้ต่อเนื่องเป็นจังหวะเดียวจนดูเหมือนไร้รอยต่อ',
          'ถ้าทุ่มไม่สำเร็จ นักยูโดระดับสูงมักไม่ปล่อยโอกาสทิ้ง แต่จะต่อเนื่องเข้าสู่เทคนิคพื้นสนามทันที เรียกว่า Renraku-waza (เทคนิคต่อเนื่อง) เช่น ทุ่มไม่ล้มแต่คว้าแขนต่อเข้าล็อกข้อศอกทันที'
        ],
        [
          'Every Judo throw breaks down into 3 continuous phases: Kuzushi (breaking balance) — pulling or pushing the opponent off-balance before attacking, since a human body that\'s still stable is very hard to throw. See the diagram below.',
          'Tsukuri (positioning/fitting in) — moving into the correct position for the chosen throw while the opponent is still off-balance, done quickly before they can recover.',
          'Kake (execution) — the final phase, actually completing the throw and putting the opponent on the ground. High-level judoka blend all three phases into what looks like a single seamless motion.',
          'If a throw fails, top-level judoka rarely let the opportunity go to waste — they immediately continue into a ground technique, called Renraku-waza (combination technique) — for example, failing to throw but grabbing the arm to immediately transition into an armbar.'
        ],
        buildJudoThrowPhasesSvg()),
      readingItem('กฎข้อห้ามและการลงโทษ (Shido)', 'Prohibited Acts & Penalties (Shido)',
        [
          'Shido (ชิโด) คือการลงโทษสำหรับความผิดกติกาเล็กน้อย เช่น การจับชุดคู่ต่อสู้ผิดตำแหน่ง (เช่น จับในแขนเสื้อ/ขากางเกงลึกเกินไป), การถอยหนีออกนอกเขตแข่งขันซ้ำๆ (Jogai), หรือการยืนเกียร์รับไม่โจมตีนานเกินไป (Passivity) — สะสมครบ 3 ครั้งจะกลายเป็น Hansoku-make (แพ้ทันที)',
          'การจับขาคู่ต่อสู้โดยตรงด้วยมือเพื่อทุ่ม (Direct Leg Grab) เคยเป็นเทคนิคที่ใช้ได้ทั่วไป แต่กติกาสากล (IJF) ยกเลิกให้ใช้ได้ตั้งแต่ราวปี 2013 เพื่อรักษาเอกลักษณ์ของยูโดในฐานะกีฬาที่เน้นเทคนิคทุ่มมากกว่ามวยปล้ำ',
          'Hansoku-make (การแพ้ฟาวล์) คือการปรับแพ้ทันทีจากความผิดกติการุนแรง เช่น เทคนิคอันตรายที่เสี่ยงทำร้ายคู่ต่อสู้ หรือสะสม Shido ครบ 3 ครั้ง — ต่างจากกีฬาต่อสู้บางประเภทตรงที่ยูโดเข้มงวดกับความปลอดภัยของข้อต่อและกระดูกสันหลังเป็นพิเศษ'
        ],
        [
          'Shido is a penalty for minor rule violations — such as gripping the opponent\'s uniform in an improper spot (too deep into the sleeve or pant leg), repeatedly stepping out of the contest area (Jogai), or excessive non-attacking passivity. Accumulating 3 Shido results in Hansoku-make (an immediate loss).',
          'Directly grabbing the opponent\'s leg with the hand to execute a throw used to be a legal technique, but international rules (IJF) banned it around 2013, to preserve Judo\'s identity as a throwing-technique-focused sport distinct from wrestling.',
          'Hansoku-make (disqualification) is an immediate loss for a serious rule violation — such as a dangerous technique that risks injuring the opponent, or accumulating 3 Shido. Unlike some other combat sports, Judo is especially strict about protecting joints and the spine.'
        ],
        svgFactStrip([
          { title: 'Shido', sub: 'penalty, x3 = loss', color: '#E8590C' },
          { title: '🚫 Direct Leg Grab', sub: 'banned since ~2013', color: '#C92A2A' },
          { title: 'Hansoku-make', sub: 'disqualification', color: '#C92A2A' }
        ], 'judo prohibited acts diagram'))
    ]
  },
  {
    id: 'bjj-basics',
    label: { th: 'บราซิลเลียนยิวยิตสู: กติกาพื้นฐาน', en: 'Brazilian Jiu-Jitsu: Basic Rules' },
    group: { th: 'บราซิลเลียนยิวยิตสู', en: 'Brazilian Jiu-Jitsu' },
    items: [
      readingItem('รู้จัก Brazilian Jiu-Jitsu', 'Meet Brazilian Jiu-Jitsu',
        [
          "บราซิลเลียนยิวยิตสู (BJJ) เป็นศิลปะการต่อสู้เน้นการปล้ำและควบคุมพื้นสนามที่พัฒนาขึ้นในบราซิล มีรากฐานจากยูโด (ผ่านการถ่ายทอดของมิตสึโยะ มาเอดะ ให้ตระกูล Gracie ในช่วงต้นคริสต์ศตวรรษที่ 1900) ได้ฉายาว่า 'ศิลปะแห่งความอ่อนโยน' เพราะเน้นเทคนิคและคานงัดที่ทำให้คนตัวเล็กเอาชนะคนตัวใหญ่กว่าได้",
          'BJJ มี 2 รูปแบบหลัก: Gi (สวมชุดคล้ายยูโด ใช้จับชุดคู่ต่อสู้ในการควบคุม) และ No-Gi (สวมเสื้อรัดรูป/กางเกงขาสั้น ไม่มีชุดให้จับ) เทคนิคบางส่วนต่างกันไปตามรูปแบบ เพราะไม่มีผ้าให้จับใน No-Gi',
          'โครงสร้างการแข่งขันแตกต่างกันมากตามระดับสายและองค์กรจัดการแข่งขัน เช่น แมตช์ระดับสายขาวมักสั้นราว 5-6 นาที ขณะที่แมตช์ระดับสายดำมักยาวถึง 10 นาที'
        ],
        [
          "Brazilian Jiu-Jitsu (BJJ) is a grappling and ground-control-focused martial art developed in Brazil, rooted in Judo (transmitted by Mitsuyo Maeda to the Gracie family in the early 1900s). It's nicknamed 'the gentle art' because it emphasizes technique and leverage that let a smaller person defeat a larger opponent.",
          'BJJ has two main formats: Gi (wearing a judo-like uniform, using grips on the fabric to control the opponent) and No-Gi (wearing a rashguard/shorts, with no fabric to grip). Some techniques differ between the two formats because No-Gi has no cloth to grab.',
          'Match structure varies widely by belt level and organizing body — for example, white belt matches are often around 5-6 minutes, while black belt matches often run up to 10 minutes.'
        ],
        svgFactStrip([
          { title: 'Ground Grappling', sub: 'from Judo roots', color: '#2F9E44' },
          { title: 'Gi / No-Gi', sub: '2 formats', color: '#1971C2' },
          { title: '5-10 min', sub: 'match length varies', color: '#F5A524' }
        ], 'brazilian jiu-jitsu match facts diagram')),
      readingItem('การให้คะแนนและการชนะ', 'Scoring & Winning',
        [
          'ชนะทันทีด้วยการยอมแพ้ (Submission): คู่ต่อสู้ตบเสื่อ/ตบตัวคู่ต่อสู้ หรือพูดยอมแพ้ เมื่อโดนล็อกข้อต่อหรือรัดคอจนทนไม่ไหว',
          'ระบบให้คะแนน (ตามกติกา IBJJF ซึ่งเป็นมาตรฐานที่ใช้แพร่หลาย): Takedown (ทุ่มลง) = 2 แต้ม, Guard Pass (ผ่านการ์ด) = 3 แต้ม, Mount/Back Control (คร่อมตัว/คุมหลัง) = 4 แต้ม, Sweep (พลิกสลับตำแหน่ง) = 2 แต้ม, Knee-on-Belly (เข่ากดท้อง) = 2 แต้ม — คะแนนให้รางวัลกับการควบคุมตำแหน่งที่ได้เปรียบ',
          "ถ้าไม่มีใครทำให้อีกฝ่ายยอมแพ้ ผู้ที่มีคะแนนมากกว่าเมื่อหมดเวลาเป็นผู้ชนะ ถ้าคะแนนเท่ากันจะตัดสินด้วย 'Advantage' (ความพยายามที่เกือบสำเร็จ) ถ้ายังเสมออีกจะให้กรรมการตัดสิน"
        ],
        [
          'An instant win by Submission: the opponent taps the mat or their opponent\'s body, or verbally submits, when they can no longer withstand a joint lock or choke.',
          'The point system (under IBJJF rules, the most widely used standard): a Takedown = 2 points, a Guard Pass = 3 points, Mount/Back Control = 4 points, a Sweep = 2 points, Knee-on-Belly = 2 points — points reward gaining and holding a dominant position.',
          "If nobody forces a submission, whoever has more points at the time limit wins. If points are tied, 'Advantages' (near-successful attempts) break the tie; if still tied, the referees decide."
        ],
        svgFactStrip([
          { title: 'Submission', sub: 'instant win', color: '#E8590C' },
          { title: 'Guard Pass = 3', sub: 'points example', color: '#1971C2' },
          { title: 'Mount/Back = 4', sub: 'points example', color: '#2F9E44' }
        ], 'bjj scoring and winning facts diagram')),
      readingItem('ตำแหน่งควบคุมพื้นฐาน', 'Basic Positions',
        [
          'Guard (การ์ด): ผู้เล่นที่อยู่ด้านล่างใช้ขาควบคุม/คุกคามผู้เล่นด้านบน — ต่างจากกีฬาปล้ำอื่นๆ ที่การอยู่ด้านล่างมักเสียเปรียบล้วนๆ ใน BJJ การ์ดถือเป็นตำแหน่งที่เป็นกลางไปจนถึงได้เปรียบ เพราะสามารถโจมตีและป้องกันตัวได้พร้อมกัน',
          'Mount (คร่อมตัว): ผู้เล่นด้านบนนั่งคร่อมลำตัวคู่ต่อสู้หันหน้าเข้าหากัน เป็นหนึ่งในตำแหน่งที่ได้เปรียบที่สุด เพราะเปิดโอกาสโจมตีด้วยเทคนิคยอมแพ้ได้หลากหลาย',
          'Back Control (คุมหลัง): ควบคุมคู่ต่อสู้จากด้านหลังโดยเกี่ยวขาทั้งสองข้าง (Hooks) เป็นตำแหน่งที่ได้เปรียบมากที่สุด เพราะคู่ต่อสู้มองไม่เห็นและป้องกันตัวได้ยาก',
          'Side Control (คุมข้าง): กดคู่ต่อสู้จากด้านข้างในแนวตั้งฉาก ควบคุมสะโพกและไหล่ของคู่ต่อสู้ไว้ เป็นตำแหน่งควบคุมพื้นฐานที่มักใช้พักหรือเปลี่ยนไปตำแหน่งอื่น'
        ],
        [
          "Guard: the bottom player uses their legs to control and threaten the top player. Unlike most grappling sports where being underneath is purely disadvantageous, in BJJ, guard is considered a neutral-to-advantageous position because it allows both attack and defense simultaneously.",
          "Mount: the top player sits astride the opponent's torso facing them — one of the most dominant positions, since it opens up many submission options.",
          "Back Control: controlling the opponent from behind with both legs hooked in — the single most dominant position, since the opponent can't see the attacker and struggles to defend effectively.",
          'Side Control: pinning the opponent perpendicular from the side, controlling their hips and shoulders — a fundamental control position often used to rest or transition to another position.'
        ],
        svgFactStrip([
          { title: 'Guard', sub: 'neutral-advantageous', color: '#1971C2' },
          { title: 'Mount', sub: 'dominant', color: '#E8590C' },
          { title: 'Back Control', sub: 'most dominant', color: '#C92A2A' },
          { title: 'Side Control', sub: 'basic pin', color: '#2F9E44' }
        ], 'bjj basic positions diagram')),
      readingItem('การรัดและการล็อกพื้นฐาน', 'Basic Submissions',
        [
          'Rear Naked Choke (รัดคอจากด้านหลัง): ใช้จากตำแหน่งคุมหลัง สอดแขนรัดรอบคอเพื่อตัดการไหลเวียนเลือด เป็นหนึ่งในเทคนิคยอมแพ้ที่ได้ผลและใช้สำเร็จบ่อยที่สุดในทุกระดับ',
          'Armbar / Juji Gatame (ล็อกข้อศอก): แยกแขนคู่ต่อสู้ออกมาแล้วดัดข้อศอกย้อนทิศทาง ใช้ได้จากหลายตำแหน่งทั้งการ์ด คร่อมตัว หรือตำแหน่งอื่นๆ',
          'Triangle Choke (รัดคอสามเหลี่ยม): ใช้ขาทั้งสองข้าง (จัดเป็นรูปสามเหลี่ยม) ล็อกรอบคอคู่ต่อสู้และแขนข้างหนึ่งเพื่อตัดการไหลเวียนเลือด เป็นเทคนิคเอกลักษณ์ที่ทำจากตำแหน่งการ์ด',
          'Kimura / Americana (ล็อกไหล่): เทคนิคล็อกข้อไหล่ที่ตั้งชื่อตามนักยูโดที่เกี่ยวข้อง ทำโดยควบคุมข้อมือคู่ต่อสู้แล้วหมุนแขนย้อนทิศทาง'
        ],
        [
          'Rear Naked Choke: applied from back control, wrapping an arm around the neck to cut off blood flow — one of the most reliable and frequently successful submissions at every skill level.',
          "Armbar (Juji Gatame): isolating the opponent's arm and hyperextending the elbow joint in reverse — can be applied from guard, mount, or several other positions.",
          "Triangle Choke: using both legs (formed into a triangle shape) to lock around the opponent's neck and one arm, cutting off blood flow — a signature technique applied from guard.",
          "Kimura / Americana: shoulder joint locks named after the judoka associated with them, applied by controlling the opponent's wrist and rotating the arm in reverse."
        ],
        svgFactStrip([
          { title: 'Rear Naked Choke', sub: 'most reliable', color: '#E8590C' },
          { title: 'Armbar', sub: 'elbow hyperextension', color: '#1971C2' },
          { title: 'Triangle Choke', sub: 'from guard', color: '#2F9E44' }
        ], 'bjj basic submissions diagram')),
      readingItem('ระบบสายคาดเอวและวัฒนธรรมยิม', 'Belt System & Gym Culture',
        [
          'การไล่ระดับสายคาดเอวของ BJJ ช้ากว่าศิลปะการต่อสู้ส่วนใหญ่อย่างเห็นได้ชัด: ขาว → ฟ้า → ม่วง → น้ำตาล → ดำ มักใช้เวลา 8-10 ปีขึ้นไปกว่าจะได้สายดำ เพราะเนื้อหาเทคนิคมีความลึกและซับซ้อนมาก',
          "'Rolling' คือศัพท์เรียกการฝึกซ้อมแบบต่อสู้จริง (เทียบเท่า Randori ในยูโด) เป็นวิธีฝึกหลักคู่กับการฝึกท่าเฉพาะ (Drilling) เพื่อพัฒนาทักษะกับคู่ฝึกที่ต่อต้านจริง",
          "'Tap Early, Tap Often' คือวัฒนธรรมความปลอดภัยหลักของ BJJ — การตบยอมแพ้เมื่อโดนล็อกไม่ใช่เรื่องน่าอาย แต่เป็นวิธีป้องกันการบาดเจ็บและฝึกได้ต่อเนื่องในระยะยาว การดื้อไม่ยอมแพ้เพราะอีโก้ถือเป็นมารยาทที่ไม่ดีในยิม"
        ],
        [
          "BJJ's belt progression is notably slower than most martial arts: White → Blue → Purple → Brown → Black, often taking 8 or more years to reach black belt because of the sport's technical depth and complexity.",
          "'Rolling' is the term for live sparring practice (equivalent to Randori in Judo) — the primary training method alongside drilling specific techniques, used to develop skill against a genuinely resisting partner.",
          "'Tap early, tap often' is BJJ's core safety culture — tapping out when caught in a submission isn't shameful, it's how practitioners avoid injury and keep training for the long term. Refusing to tap out of ego is considered poor gym etiquette."
        ],
        svgFactStrip([
          { title: 'White→Black', sub: '8-10+ years', color: '#1971C2' },
          { title: 'Rolling', sub: 'live sparring', color: '#2F9E44' },
          { title: 'Tap Early', sub: 'safety culture', color: '#E8590C' }
        ], 'bjj belt system and gym culture diagram')),
      readingItem('แนวคิดหลัก: ตำแหน่งก่อนการยอมแพ้ และการผ่านการ์ด', 'Core Concept: Position Before Submission & Guard Passing',
        [
          "หลักคิดสำคัญที่สุดข้อหนึ่งของ BJJ คือ 'ตำแหน่งมาก่อนการยอมแพ้' (Position Before Submission) — นักกีฬาที่เก่งจะไม่รีบพยายามล็อกจากตำแหน่งเสียเปรียบ แต่จะไล่ควบคุมตำแหน่งที่ได้เปรียบมากขึ้นเรื่อยๆ ก่อนแล้วค่อยหาจังหวะล็อกทีหลัง",
          'ลำดับขั้นตำแหน่งจากได้เปรียบมากไปน้อย (คร่าวๆ): Back Control > Mount > Side Control/Knee-on-Belly > Half Guard > Guard (ทั้งสองฝ่ายเท่ากันโดยประมาณ) > อยู่ใต้ Side Control/Mount ของคู่ต่อสู้ (เสียเปรียบที่สุด)',
          'Guard Passing (การผ่านการ์ด) คือเป้าหมายหลักของผู้เล่นด้านบน: ต้องหาทางผ่านขาคู่ต่อสู้ไปสู่ตำแหน่งควบคุมที่ดีกว่า มี 2 สไตล์หลัก คือ Pressure Passing (ใช้น้ำหนักตัวกดทับบีบพื้นที่คู่ต่อสู้) และ Speed Passing (ใช้ความเร็วเคลื่อนที่รอบขาคู่ต่อสู้ก่อนตั้งตัวทัน)',
          'ในทางกลับกัน ผู้เล่นด้านล่าง (ผู้ถือการ์ด) มีเป้าหมาย 2 อย่างคู่กัน: พลิกสลับตำแหน่งขึ้นมาอยู่ด้านบน (Sweep) หรือหาจังหวะล็อกจากการ์ดโดยตรง (เช่น Triangle Choke) โดยไม่ต้องรอขึ้นไปอยู่ด้านบนก่อน'
        ],
        [
          "One of BJJ's most important concepts is 'Position Before Submission' — skilled practitioners don't rush a submission attempt from a disadvantageous position, but instead progress to increasingly dominant positions first, then look for a submission opportunity.",
          'A rough position hierarchy from most to least advantageous: Back Control > Mount > Side Control/Knee-on-Belly > Half Guard > Guard (roughly neutral between both players) > being underneath the opponent\'s Side Control or Mount (the most disadvantageous).',
          "Guard Passing is the top player's primary goal — finding a way past the opponent's legs to a better control position. There are two main styles: Pressure Passing (using body weight to compress the opponent's space) and Speed Passing (moving quickly around the opponent's legs before they can react).",
          'Conversely, the bottom player (holding guard) has two paired goals: sweeping to reverse into the top position, or looking for a submission directly from guard (such as a Triangle Choke) without needing to get on top first.'
        ],
        svgFlowSteps([
          { title: 'Position', sub: 'get dominant control', color: '#1971C2' },
          { title: 'Pass', sub: 'past the guard', color: '#2F9E44' },
          { title: 'Submit', sub: 'finish the fight', color: '#E8590C' }
        ], 'bjj position before submission flow diagram')),
      readingItem('รูปแบบการแข่งขัน: IBJJF กับ ADCC', 'Competition Formats: IBJJF vs ADCC',
        [
          'IBJJF (International Brazilian Jiu-Jitsu Federation) เป็นองค์กรจัดการแข่งขันประเภท Gi ที่ใหญ่ที่สุดในโลก ใช้กติกาให้คะแนนแบบมาตรฐานที่กล่าวถึงในบทเรียนก่อนหน้า และมีกฎจำกัดเทคนิคล็อกขาบางแบบตามระดับสาย เพื่อความปลอดภัยของนักกีฬารุ่นเล็ก',
          'ADCC (Abu Dhabi Combat Club) คือการแข่งขันประเภท No-Gi ที่ได้รับการยกย่องสูงสุดในวงการ จัดทุก 2 ปี ใช้กติกาที่เปิดกว้างกว่า อนุญาตให้ใช้เทคนิคล็อกขาได้หลากหลายกว่า IBJJF อย่างชัดเจน',
          'ความแตกต่างสำคัญระหว่างสองสนาม: กฎเรื่องเทคนิคล็อกขา (Leg Locks) — IBJJF จำกัดเทคนิคล็อกขาบางแบบ (เช่น Heel Hook) ไว้เฉพาะระดับสายสูง เพื่อป้องกันอาการบาดเจ็บในนักกีฬาที่ยังไม่มีประสบการณ์พอจะป้องกันตัวจากท่านี้ ขณะที่ ADCC และกติกา No-Gi ทั่วไปมักอนุญาตให้ใช้ได้กว้างกว่า',
          'BJJ มีบทบาทสำคัญในการวางรากฐานกีฬา MMA สมัยใหม่: แชมป์ยุคแรกๆ ของ UFC หลายคน เช่น Royce Gracie เป็นนักกีฬา BJJ ที่ใช้เทคนิคควบคุมพื้นสนามเอาชนะคู่ต่อสู้ที่ตัวใหญ่กว่ามาก พิสูจน์ให้วงการเห็นความสำคัญของการต่อสู้บนพื้น'
        ],
        [
          'IBJJF (International Brazilian Jiu-Jitsu Federation) is the largest organizer of Gi competitions in the world, using the standard point system covered in the previous lesson, and restricting certain leg lock techniques by belt level for the safety of less experienced competitors.',
          'ADCC (Abu Dhabi Combat Club) is the most prestigious No-Gi tournament in the sport, held every 2 years, using more open rules that permit a noticeably wider range of leg lock techniques than IBJJF.',
          'A key difference between the two: leg lock rules — IBJJF restricts certain leg lock techniques (such as the Heel Hook) to higher belt levels only, to prevent injury in less experienced athletes who may not yet be able to defend against them, while ADCC and most No-Gi rulesets generally allow them more broadly.',
          'BJJ played a foundational role in shaping modern MMA — several of the UFC\'s earliest champions, such as Royce Gracie, were BJJ specialists who beat much larger opponents using ground control, proving to the wider combat sports world how important ground fighting is.'
        ],
        svgFactStrip([
          { title: 'IBJJF', sub: 'largest Gi federation', color: '#1971C2' },
          { title: 'ADCC', sub: 'top No-Gi event', color: '#E8590C' },
          { title: 'MMA Roots', sub: 'Royce Gracie era', color: '#2F9E44' }
        ], 'bjj competition formats diagram'))
    ]
  }
];

function trackById(id) { for (var i = 0; i < TRACKS.length; i++) if (TRACKS[i].id === id) return TRACKS[i]; return TRACKS[0]; }
function progressKey(trackId, itemIndex) { return trackId + '::' + itemIndex; }
function loadProgress() { try { return JSON.parse(localStorage.getItem('tanot:sports:progress')) || {}; } catch (e) { return {}; } }
function saveProgress(p) { try { localStorage.setItem('tanot:sports:progress', JSON.stringify(p)); } catch (e) {} }
function trackCompleted(track, progress) {
  return track.items.every(function (it, i) { return !!progress[progressKey(track.id, i)]; });
}
function allTracksCompleted(progress) { return TRACKS.every(function (tr) { return trackCompleted(tr, progress); }); }
function isUnlocked(trackIdx, itemIdx, progress) {
  if (trackIdx === 0 && itemIdx === 0) return true;
  if (itemIdx > 0) return !!progress[progressKey(TRACKS[trackIdx].id, itemIdx - 1)];
  return trackCompleted(TRACKS[trackIdx - 1], progress);
}

/* ══════════════════════════════════════════════════════════════════
   Gamification — เลเวล/XP/สตรีค/เหรียญตรา (ก็อปจาก music.js ให้ประสบการณ์เหมือนกันทั้งเว็บ)
   ══════════════════════════════════════════════════════════════════ */
var XP_KEY = 'tanot:sports:xp';
var STREAK_KEY = 'tanot:sports:streak';
var BADGES_KEY = 'tanot:sports:badges';
var XP_PER_EXERCISE = 20;
var XP_PER_TRACK_BONUS = 50;
var XP_PER_LEVEL = 50;

function loadXp() { try { return parseInt(localStorage.getItem(XP_KEY), 10) || 0; } catch (e) { return 0; } }
function saveXp(xp) { try { localStorage.setItem(XP_KEY, String(xp)); } catch (e) {} }
function levelFromXp(xp) { return 1 + Math.floor(xp / XP_PER_LEVEL); }
function xpIntoLevel(xp) { return xp % XP_PER_LEVEL; }
function levelTitle(level) {
  var th = ['นักกีฬามือใหม่', 'นักเรียนกีฬา', 'นักกีฬาฝึกหัด', 'นักกีฬารุ่นเยาว์', 'นักกีฬามือโปร', 'เซียนกีฬา'];
  var en = ['Sports Newbie', 'Sports Student', 'Junior Athlete', 'Rising Athlete', 'Pro Athlete', 'Sports Master'];
  var idx = Math.min(Math.floor((level - 1) / 2), th.length - 1);
  return getUILang() === 'en' ? en[idx] : th[idx];
}

function todayStr() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function dateStrOffset(days) { var d = new Date(); d.setDate(d.getDate() + days); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function loadStreak() { try { return JSON.parse(localStorage.getItem(STREAK_KEY)) || { count: 0, lastDate: '' }; } catch (e) { return { count: 0, lastDate: '' }; } }
function saveStreak(s) { try { localStorage.setItem(STREAK_KEY, JSON.stringify(s)); } catch (e) {} }
function bumpStreak() {
  var s = loadStreak();
  var today = todayStr();
  if (s.lastDate === today) return s;
  s.count = (s.lastDate === dateStrOffset(-1)) ? s.count + 1 : 1;
  s.lastDate = today;
  saveStreak(s);
  return s;
}

function loadBadges() { try { return JSON.parse(localStorage.getItem(BADGES_KEY)) || []; } catch (e) { return []; } }
function saveBadges(b) { try { localStorage.setItem(BADGES_KEY, JSON.stringify(b)); } catch (e) {} }

var BADGE_DEFS = [
  { id: 'first-pass', icon: '🥉', th: 'ก้าวแรก', en: 'First Step' },
  { id: 'track-football-basics', icon: '⚽', th: 'เจ้ากติกาฟุตบอล', en: 'Football Rules Master' },
  { id: 'track-basketball-basics', icon: '🏀', th: 'เจ้ากติกาบาสเกตบอล', en: 'Basketball Rules Master' },
  { id: 'track-volleyball-basics', icon: '🏐', th: 'เจ้ากติกาวอลเลย์บอล', en: 'Volleyball Rules Master' },
  { id: 'track-badminton-basics', icon: '🏸', th: 'เจ้ากติกาแบดมินตัน', en: 'Badminton Rules Master' },
  { id: 'track-tennis-basics', icon: '🎾', th: 'เจ้ากติกาเทนนิส', en: 'Tennis Rules Master' },
  { id: 'track-table-tennis-basics', icon: '🏓', th: 'เจ้ากติกาเทเบิลเทนนิส', en: 'Table Tennis Rules Master' },
  { id: 'track-muay-thai-basics', icon: '🇹🇭', th: 'เจ้ากติกามวยไทย', en: 'Muay Thai Rules Master' },
  { id: 'track-taekwondo-basics', icon: '🥋', th: 'เจ้ากติกาเทควันโด', en: 'Taekwondo Rules Master' },
  { id: 'track-boxing-basics', icon: '🥊', th: 'เจ้ากติกามวยสากล', en: 'Boxing Rules Master' },
  { id: 'track-judo-basics', icon: '🤼', th: 'เจ้ากติกายูโด', en: 'Judo Rules Master' },
  { id: 'track-bjj-basics', icon: '🇧🇷', th: 'เจ้ากติกา BJJ', en: 'BJJ Rules Master' },
  { id: 'streak-3', icon: '🔥', th: 'ขยัน 3 วันติด', en: '3-Day Streak' },
  { id: 'streak-7', icon: '🔥', th: 'สัปดาห์นักสู้', en: '7-Day Streak' },
  { id: 'all-tracks', icon: '🏆', th: 'จบคอร์สที่มีทั้งหมด!', en: 'All Lessons Complete!' }
];
function badgeLabel(def) { return getUILang() === 'en' ? def.en : def.th; }

function checkAwardBadges(progress, streak) {
  var earned = loadBadges();
  var newly = [];
  function award(id) { if (earned.indexOf(id) === -1) { earned.push(id); newly.push(id); } }
  award('first-pass');
  TRACKS.forEach(function (tr) { if (trackCompleted(tr, progress)) award('track-' + tr.id); });
  if (streak.count >= 3) award('streak-3');
  if (streak.count >= 7) award('streak-7');
  if (allTracksCompleted(progress)) award('all-tracks');
  if (newly.length) saveBadges(earned);
  return newly;
}

/* ══════════════════════════════════════════════════════════════════
   UI wiring
   ══════════════════════════════════════════════════════════════════ */
if (typeof document !== 'undefined' && document.getElementById('sportsRoot')) {
  var $ = function (id) { return document.getElementById(id); };
  var trackMenuBtn = $('trackMenuBtn'), trackMenuPanel = $('trackMenuPanel'), currentTrackLabel = $('currentTrackLabel'),
      itemList = $('itemList'), lockMsg = $('lockMsg'), instructionsBox = $('instructionsBox'),
      itemHeading = $('itemHeading'), langToggle = $('langToggle'),
      markReadBtn = $('markReadBtn'), resultBanner = $('resultBanner'),
      levelNumEl = $('levelNum'), levelTitleEl = $('levelTitleEl'), xpFillEl = $('xpFill'),
      streakCountEl = $('streakCount'), badgeRowEl = $('badgeRow'), toastWrap = $('toastWrap'),
      confettiLayer = $('confettiLayer');

  var state = { trackId: TRACKS[0].id, itemIndex: 0 };

  function applyI18n() {
    document.documentElement.lang = getUILang();
    document.title = t('pageTitle') + ' | Tanot';
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    if (langToggle) {
      langToggle.querySelectorAll('span').forEach(function (span) {
        span.classList.toggle('active', span.getAttribute('data-lt') === getUILang());
      });
    }
    renderGamifyBar();
    renderTrackMenu();
    renderItemList();
    selectItem(state.itemIndex);
  }

  function renderGamifyBar() {
    var xp = loadXp();
    var level = levelFromXp(xp);
    if (levelNumEl) levelNumEl.textContent = String(level);
    if (levelTitleEl) levelTitleEl.textContent = levelTitle(level);
    if (xpFillEl) xpFillEl.style.width = Math.round((xpIntoLevel(xp) / XP_PER_LEVEL) * 100) + '%';
    var streak = loadStreak();
    if (streakCountEl) streakCountEl.textContent = String(streak.count);
    if (badgeRowEl) {
      var earned = loadBadges();
      badgeRowEl.innerHTML = '';
      BADGE_DEFS.forEach(function (def) {
        var b = document.createElement('div');
        b.className = 'sp-badge' + (earned.indexOf(def.id) !== -1 ? ' earned' : '');
        b.textContent = def.icon;
        b.title = badgeLabel(def) + (earned.indexOf(def.id) !== -1 ? '' : ' 🔒');
        badgeRowEl.appendChild(b);
      });
    }
  }

  var toastQueueState = [];
  var toastBusy = false;
  function showToastQueue(items) {
    if (!items || !items.length) return;
    toastQueueState = toastQueueState.concat(items);
    if (!toastBusy) processToastQueue();
  }
  function processToastQueue() {
    if (!toastQueueState.length) { toastBusy = false; return; }
    toastBusy = true;
    var item = toastQueueState.shift();
    var el = document.createElement('div');
    el.className = 'sp-toast';
    el.textContent = item.icon + ' ' + item.text;
    if (toastWrap) toastWrap.appendChild(el);
    setTimeout(function () {
      el.classList.add('leaving');
      setTimeout(function () { el.remove(); processToastQueue(); }, 300);
    }, 2200);
  }

  var CONFETTI_COLORS = ['#16A34A', '#F97316', '#17B76A', '#F5A524', '#3B9BEA'];
  function spawnConfetti() {
    if (!confettiLayer) return;
    confettiLayer.innerHTML = '';
    for (var i = 0; i < 18; i++) {
      var piece = document.createElement('span');
      piece.className = 'sp-confetti-piece';
      piece.style.left = Math.round(Math.random() * 100) + '%';
      piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      piece.style.animationDuration = (900 + Math.random() * 700) + 'ms';
      piece.style.animationDelay = Math.round(Math.random() * 200) + 'ms';
      confettiLayer.appendChild(piece);
    }
  }

  /* ให้รางวัลเฉพาะตอน "ผ่านครั้งแรก" ของแต่ละ item (เช็คจาก progress เดิมก่อนบันทึกทับ) กันฟาร์ม XP */
  function awardForPass(track, progress) {
    var xp = loadXp();
    var prevLevel = levelFromXp(xp);
    xp += XP_PER_EXERCISE;
    var trackJustCompleted = trackCompleted(track, progress);
    if (trackJustCompleted) xp += XP_PER_TRACK_BONUS;
    saveXp(xp);
    var streak = bumpStreak();
    var newBadges = checkAwardBadges(progress, streak);
    var newLevel = levelFromXp(xp);

    renderGamifyBar();
    spawnConfetti();
    var toasts = [];
    if (trackJustCompleted) toasts.push({ icon: '🏁', text: t('toastTrackDone', { track: pick(track.label) }) });
    newBadges.forEach(function (id) {
      var def = BADGE_DEFS.filter(function (d) { return d.id === id; })[0];
      if (def) toasts.push({ icon: def.icon, text: t('toastBadge', { badge: badgeLabel(def) }) });
    });
    if (newLevel > prevLevel) toasts.push({ icon: '⭐', text: t('toastLevelUp', { level: newLevel, title: levelTitle(newLevel) }) });
    showToastQueue(toasts);
  }

  function passItem(trackIdx, itemIdx) {
    var track = TRACKS[trackIdx];
    var progress = loadProgress();
    var key = progressKey(track.id, itemIdx);
    var firstPass = !progress[key];
    progress[key] = true;
    saveProgress(progress);
    if (firstPass) awardForPass(track, progress);
    renderItemList();
  }

  function renderTrackMenu() {
    var track = trackById(state.trackId);
    if (currentTrackLabel) currentTrackLabel.textContent = pick(track.label);
    if (!trackMenuPanel) return;
    trackMenuPanel.innerHTML = '';
    var lastGroup = null;
    TRACKS.forEach(function (tr) {
      var groupText = pick(tr.group);
      if (groupText !== lastGroup) {
        var groupEl = document.createElement('div');
        groupEl.className = 'sp-track-group-label';
        groupEl.textContent = groupText;
        trackMenuPanel.appendChild(groupEl);
        lastGroup = groupText;
      }
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sp-track-menu-item' + (tr.id === state.trackId ? ' active' : '');
      btn.textContent = pick(tr.label);
      btn.addEventListener('click', function () { selectTrack(tr.id); closeTrackMenu(); });
      trackMenuPanel.appendChild(btn);
    });
  }

  function closeTrackMenu() {
    if (trackMenuBtn) trackMenuBtn.classList.remove('open');
    if (trackMenuPanel) trackMenuPanel.classList.remove('open');
    if (trackMenuBtn) trackMenuBtn.setAttribute('aria-expanded', 'false');
  }
  function toggleTrackMenu() {
    var open = trackMenuPanel.classList.toggle('open');
    trackMenuBtn.classList.toggle('open', open);
    trackMenuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  if (trackMenuBtn) {
    trackMenuBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleTrackMenu(); });
  }
  if (trackMenuPanel) trackMenuPanel.addEventListener('click', function (e) { e.stopPropagation(); });
  document.addEventListener('click', closeTrackMenu);

  function itemLabel(track, item) { return pick(item.heading); }

  function renderItemList() {
    var trackIdx = TRACKS.indexOf(trackById(state.trackId));
    var track = TRACKS[trackIdx];
    var progress = loadProgress();
    itemList.innerHTML = '';
    track.items.forEach(function (item, i) {
      var unlocked = isUnlocked(trackIdx, i, progress);
      var passed = !!progress[progressKey(track.id, i)];
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sp-item' + (i === state.itemIndex ? ' active' : '') + (unlocked ? '' : ' locked');
      btn.textContent = (passed ? '✅ ' : unlocked ? '📖 ' : '🔒 ') + itemLabel(track, item);
      btn.addEventListener('click', function () {
        if (unlocked) selectItem(i);
        else showLockMsg();
      });
      itemList.appendChild(btn);
    });
  }

  function showLockMsg() {
    lockMsg.textContent = t('lockedMsg');
    lockMsg.style.display = 'block';
    clearTimeout(lockMsg._hideTimer);
    lockMsg._hideTimer = setTimeout(function () { lockMsg.style.display = 'none'; }, 2600);
  }

  function selectTrack(trackId) {
    state.trackId = trackId;
    state.itemIndex = 0;
    renderTrackMenu();
    renderItemList();
    selectItem(0);
  }

  function selectItem(idx) {
    state.itemIndex = idx;
    renderItemList();
    var track = trackById(state.trackId);
    var item = track.items[idx];

    resultBanner.style.display = 'none';
    resultBanner.className = 'sp-result-banner';

    itemHeading.textContent = pick(item.heading);
    instructionsBox.innerHTML = pick(item.body).map(function (p) { return '<p>' + p + '</p>'; }).join('');
    if (item.diagram) instructionsBox.innerHTML += item.diagram;
    markReadBtn.style.display = 'inline-flex';
    markReadBtn.disabled = false;

    var progress = loadProgress();
    var trackIdx = TRACKS.indexOf(track);
    var isLastOfTrack = idx === track.items.length - 1;
    var alreadyPassed = !!progress[progressKey(track.id, idx)];
    if (alreadyPassed && isLastOfTrack && trackCompleted(track, progress)) {
      resultBanner.textContent = t('trackDoneMsg');
      resultBanner.className = 'sp-result-banner pass';
      resultBanner.style.display = 'block';
    }
  }

  if (markReadBtn) {
    markReadBtn.addEventListener('click', function () {
      var trackIdx = TRACKS.indexOf(trackById(state.trackId));
      var track = TRACKS[trackIdx];
      passItem(trackIdx, state.itemIndex);
      var isLast = state.itemIndex === track.items.length - 1;
      if (!isLast) {
        selectItem(state.itemIndex + 1);
      } else {
        resultBanner.textContent = t('trackDoneMsg');
        resultBanner.className = 'sp-result-banner pass';
        resultBanner.style.display = 'block';
      }
    });
  }

  if (langToggle) {
    langToggle.addEventListener('click', function () {
      setUILang(getUILang() === 'en' ? 'th' : 'en');
      applyI18n();
    });
  }

  applyI18n();
}
