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
  return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + color + '" stroke-width="3"/>' +
    '<polygon points="' + x2 + ',' + y2 + ' ' + hx1 + ',' + hy1 + ' ' + hx2 + ',' + hy2 + '" fill="' + color + '"/>';
}
function svgWrap(inner, viewW, viewH, maxW, label) {
  return '<div style="text-align:center;margin:16px 0">' +
    '<svg viewBox="0 0 ' + viewW + ' ' + viewH + '" style="width:100%;max-width:' + maxW + 'px;height:auto;display:block;margin:0 auto" role="img" aria-label="' + label + '">' +
    inner + '</svg></div>';
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
        ]),
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
        ]),
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
        ])
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
        ]),
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
        ]),
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
        ])
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
        ]),
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
        ]),
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
        ])
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
        ]),
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
        ]),
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
        ])
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
        ]),
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
        ]),
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
        ])
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
