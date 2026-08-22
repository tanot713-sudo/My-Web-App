/* ══════════════════════════════════════════════════════════════════
   Tanot — เรียนกีฬา (sports.js)
   สเตจ 1: ฟุตบอล — กติกาพื้นฐาน
   สถาปัตยกรรมก็อป-แล้วปรับจาก music.js (แถบเกม/เมนูแฮมเบอร์เกอร์/sidebar ล็อกลำดับ/i18n TH-EN)
   เรียบง่ายกว่า music.js เพราะไม่มีโน้ตดนตรี/เสียง — แต่ละ item เป็น 'reading' (เนื้อหาอ่านอย่างเดียว
   กดปุ่มเพื่อไปต่อ) หรือ 'quiz' (โจทย์ปรนัย 4 ตัวเลือก ตอบถูกถึงปลดล็อกข้อถัดไป) เท่านั้น
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
    correctMsg: '✅ ถูกต้อง! ปลดล็อกข้อถัดไปแล้ว',
    trackDoneMsg: '🎉 จบบทเรียนนี้แล้ว! เลือกบทเรียนถัดไปจากเมนู ☰ ด้านบนได้เลย',
    toastTrackDone: 'จบบทเรียน "{track}" แล้ว! 🎉',
    toastBadge: 'ได้รับเหรียญตรา: "{badge}"!',
    toastLevelUp: 'เลเวลอัป! เลเวล {level} — {title}'
  },
  en: {
    pageTitle: 'Learn Sports', crumbResp: 'Responsibilities', crumbSports: 'Learn Sports',
    markReadBtn: '✓ Got it, continue',
    lockedMsg: 'This lesson is locked — pass the previous one first.',
    correctMsg: '✅ Correct! Next one unlocked.',
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
   เนื้อหาบทเรียน — ทุกข้อเป็น 'reading' (อ่านอย่างเดียว) หรือ 'quiz' (ปรนัย 4 ตัวเลือก)
   ══════════════════════════════════════════════════════════════════ */
/* diagramHtml (ถ้ามี) เป็น HTML คงที่ (มักเป็น SVG) แปะต่อท้ายย่อหน้า — ไม่ต้องพึ่งภาษา
   เพราะป้ายในไดอะแกรมใช้คำสากลที่ใช้ตรงตัวทั้งไทย/อังกฤษอยู่แล้ว (GK, DF, Instep ฯลฯ) */
function readingItem(headingTh, headingEn, paragraphsTh, paragraphsEn, diagramHtml) {
  return { kind: 'reading', heading: { th: headingTh, en: headingEn }, body: { th: paragraphsTh, en: paragraphsEn }, diagram: diagramHtml };
}
function mcqOpt(key, th, en) { return { key: key, label: { th: th, en: en } }; }
function mcqItem(promptTh, promptEn, options, answer) {
  return { kind: 'quiz', prompt: { th: promptTh, en: promptEn }, options: options, answer: answer };
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
      mcqItem(
        'ฟุตบอล 1 ทีมมีผู้เล่นกี่คนในสนาม (รวมผู้รักษาประตู)?', 'How many players does one football team have on the field (including the goalkeeper)?',
        [mcqOpt('a', '11 คน', '11 players'), mcqOpt('b', '10 คน', '10 players'),
         mcqOpt('c', '9 คน', '9 players'), mcqOpt('d', '12 คน', '12 players')],
        'a'
      ),
      mcqItem(
        'การแข่งขันฟุตบอลมาตรฐานแบ่งเวลาอย่างไร?', 'How is a standard football match divided?',
        [mcqOpt('a', '2 ครึ่ง ครึ่งละ 45 นาที', '2 halves of 45 minutes each'),
         mcqOpt('b', '2 ครึ่ง ครึ่งละ 30 นาที', '2 halves of 30 minutes each'),
         mcqOpt('c', '4 ควอเตอร์ ควอเตอร์ละ 20 นาที', '4 quarters of 20 minutes each'),
         mcqOpt('d', 'ครึ่งเดียว 90 นาทีรวด', 'One straight 90-minute period')],
        'a'
      ),
      mcqItem(
        'ใครเป็นคนเดียวที่สามารถใช้มือสัมผัสบอลได้ (ในเขตโทษของทีมตัวเอง)?', 'Who is the only player allowed to touch the ball with their hands (inside their own penalty area)?',
        [mcqOpt('a', 'ผู้รักษาประตู', 'The goalkeeper'), mcqOpt('b', 'กองหลัง', 'A defender'),
         mcqOpt('c', 'กองหน้า', 'A forward'), mcqOpt('d', 'กัปตันทีม', 'The team captain')],
        'a'
      ),
      mcqItem(
        'ผู้เล่นจะ "ล้ำหน้า" (Offside) เมื่อใด?', 'When is a player considered "offside"?',
        [mcqOpt('a', 'อยู่ใกล้ประตูคู่แข่งกว่าบอลและผู้เล่นรองสุดท้ายฝ่ายตรงข้าม ตอนเพื่อนส่งบอลมาให้', 'Nearer to the opponent\'s goal than both the ball and the second-to-last opponent, at the moment a teammate passes'),
         mcqOpt('b', 'ยืนอยู่ในเขตโทษของทีมตัวเอง', 'Standing in their own penalty area'),
         mcqOpt('c', 'วิ่งเร็วกว่าคู่แข่ง', 'Running faster than the opponent'),
         mcqOpt('d', 'ถือบอลไว้นานเกินไป', 'Holding the ball too long')],
        'a'
      ),
      mcqItem(
        'ถ้าผู้เล่นได้ใบเหลือง 2 ใบในเกมเดียวกัน จะเกิดอะไรขึ้น?', 'What happens if a player receives 2 yellow cards in the same match?',
        [mcqOpt('a', 'กลายเป็นใบแดง ถูกไล่ออกจากสนามทันที', 'It becomes a red card — sent off immediately'),
         mcqOpt('b', 'โดนแค่เตือนเฉยๆ ไม่มีผลอะไรเพิ่ม', 'Just a warning, no further consequence'),
         mcqOpt('c', 'โดนแบนแค่เกมถัดไปเท่านั้น', 'Only banned for the next match'),
         mcqOpt('d', 'ทีมเสียจุดโทษทันที', "The team immediately concedes a penalty")],
        'a'
      ),
      mcqItem(
        'ทีมที่โดนไล่ผู้เล่นออกด้วยใบแดง ต้องเล่นต่ออย่างไร?', 'How must a team play after one of its players is sent off with a red card?',
        [mcqOpt('a', 'เล่นต่อด้วยผู้เล่นน้อยกว่าคู่แข่ง 1 คน ตลอดเกมที่เหลือ', 'Play the rest of the match with one fewer player than the opponent'),
         mcqOpt('b', 'ส่งตัวสำรองลงแทนได้ทันที', 'Bring on a substitute right away'),
         mcqOpt('c', 'หยุดพัก 10 นาทีก่อนเล่นต่อ', 'Take a 10-minute break before resuming'),
         mcqOpt('d', 'ทีมคู่แข่งได้ประตูฟรีทันที', 'The opponent gets a free goal immediately')],
        'a'
      ),
      mcqItem(
        'เวลาทดเวลาบาดเจ็บ (Stoppage Time) มีไว้เพื่ออะไร?', 'What is stoppage time for?',
        [mcqOpt('a', 'ชดเชยเวลาที่เสียไประหว่างครึ่งนั้น (บาดเจ็บ เปลี่ยนตัว ฯลฯ)', 'To compensate for time lost during that half (injuries, substitutions, etc.)'),
         mcqOpt('b', 'ให้ทีมเจ้าบ้านได้เปรียบเสมอ', 'To always favor the home team'),
         mcqOpt('c', 'เพื่อยืดเกมให้ยาวขึ้นเป็นมาตรฐาน 2 เท่า', 'To always double the length of the match'),
         mcqOpt('d', 'ใช้เฉพาะรอบชิงชนะเลิศเท่านั้น', 'Only applies in the final match of a tournament')],
        'a'
      ),
      mcqItem(
        'ผู้เล่น (ที่ไม่ใช่ผู้รักษาประตูในเขตโทษตัวเอง) ห้ามใช้ส่วนไหนของร่างกายสัมผัสบอล?', 'Which body part are outfield players (outside the goalkeeper-in-their-own-area exception) forbidden from touching the ball with?',
        [mcqOpt('a', 'มือและแขน', 'Hands and arms'), mcqOpt('b', 'เท้า', 'Feet'),
         mcqOpt('c', 'หัว', 'The head'), mcqOpt('d', 'หน้าอก', 'The chest')],
        'a'
      ),
      mcqItem(
        'ในแผนการเล่น 4-4-2 มีกองหลัง (DF) กี่คน?', 'In the 4-4-2 formation, how many defenders (DF) are there?',
        [mcqOpt('a', '4 คน', '4'), mcqOpt('b', '2 คน', '2'),
         mcqOpt('c', '3 คน', '3'), mcqOpt('d', '5 คน', '5')],
        'a'
      ),
      mcqItem(
        'การเตะแบบ Instep (หลังเท้า) เหมาะกับการใช้งานแบบไหนที่สุด?', 'What is the Instep kick (top-of-foot) best suited for?',
        [mcqOpt('a', 'ยิงประตูหรือส่งบอลไกล ต้องการแรงพุ่งตรง', 'Shooting or long passes that need power and a direct trajectory'),
         mcqOpt('b', 'ส่งบอลระยะสั้นให้แม่นยำที่สุด', 'The most accurate short passes'),
         mcqOpt('c', 'เตะโค้งหลบแนวรับ', 'Curving the ball around defenders'),
         mcqOpt('d', 'ไม่มีจุดประสงค์เฉพาะ ใช้แทนกันได้หมด', 'No specific purpose — interchangeable with the others')],
        'a'
      )
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
      mcqItem(
        'บาสเกตบอล 1 ทีมมีผู้เล่นกี่คนในสนาม?', 'How many players does one basketball team have on the court?',
        [mcqOpt('a', '5 คน', '5 players'), mcqOpt('b', '6 คน', '6 players'),
         mcqOpt('c', '7 คน', '7 players'), mcqOpt('d', '4 คน', '4 players')],
        'a'
      ),
      mcqItem(
        'การแข่งขันบาสเกตบอลมาตรฐานแบ่งเวลาอย่างไร?', 'How is a standard basketball match divided?',
        [mcqOpt('a', '4 ควอเตอร์', '4 quarters'), mcqOpt('b', '2 ครึ่ง', '2 halves'),
         mcqOpt('c', '3 พีเรียด', '3 periods'), mcqOpt('d', '5 ควอเตอร์', '5 quarters')],
        'a'
      ),
      mcqItem(
        'ยิงจากนอกเส้นสามคะแนน (3-point line) ได้กี่คะแนน?', 'How many points is a shot from outside the 3-point line worth?',
        [mcqOpt('a', '3 คะแนน', '3 points'), mcqOpt('b', '2 คะแนน', '2 points'),
         mcqOpt('c', '1 คะแนน', '1 point'), mcqOpt('d', '4 คะแนน', '4 points')],
        'a'
      ),
      mcqItem(
        'ยิงโทษ (Free Throw) แต่ละครั้งได้กี่คะแนน?', 'How many points is each free throw worth?',
        [mcqOpt('a', '1 คะแนน', '1 point'), mcqOpt('b', '2 คะแนน', '2 points'),
         mcqOpt('c', '3 คะแนน', '3 points'), mcqOpt('d', '0 คะแนน', '0 points')],
        'a'
      ),
      mcqItem(
        'ถ้าผู้เล่นเลี้ยงบอลหยุดแล้วเริ่มเลี้ยงใหม่ เรียกว่าอะไรและเกิดผลอย่างไร?', 'What is it called (and what happens) when a player stops dribbling then starts again?',
        [mcqOpt('a', 'Double Dribble — เสียสิทธิ์ครองบอลให้ฝ่ายตรงข้าม', 'Double Dribble — possession goes to the other team'),
         mcqOpt('b', 'Traveling — ได้โทษ 2 ครั้ง', 'Traveling — 2 penalties issued'),
         mcqOpt('c', 'ไม่ผิดกติกาอะไร เล่นต่อได้ปกติ', 'Not a violation at all, play continues normally'),
         mcqOpt('d', 'ฟาวล์ส่วนตัว 1 ครั้งให้ผู้เล่นคนนั้น', "A personal foul is added to that player")],
        'a'
      ),
      mcqItem(
        'ผู้เล่นที่ทำฟาวล์ส่วนตัวครบโควตาแล้ว (Fouled Out) จะเกิดอะไรขึ้น?', 'What happens to a player who has been "fouled out" (reached their personal foul limit)?',
        [mcqOpt('a', 'ต้องออกจากเกมทันที เล่นต่อไม่ได้', 'They must leave the game immediately and cannot continue playing'),
         mcqOpt('b', 'โดนใบเหลืองเตือน', 'They get a yellow-card warning'),
         mcqOpt('c', 'เสียสิทธิ์ยิงโทษไปตลอดเกม', 'They permanently lose the right to shoot free throws'),
         mcqOpt('d', 'ทีมเสีย 1 คะแนนทันที', 'The team immediately loses 1 point')],
        'a'
      ),
      mcqItem(
        'นาฬิกายิง (Shot Clock) มาตรฐานให้เวลากี่วินาทีในการยิงให้บอลโดนห่วง?', 'How many seconds does the standard shot clock give a team to get a shot to hit the rim?',
        [mcqOpt('a', '24 วินาที', '24 seconds'), mcqOpt('b', '45 วินาที', '45 seconds'),
         mcqOpt('c', '10 วินาที', '10 seconds'), mcqOpt('d', '60 วินาที', '60 seconds')],
        'a'
      ),
      mcqItem(
        'การเดินโดยไม่เลี้ยงบอล เรียกว่าอะไร?', 'What is it called when a player walks without dribbling the ball?',
        [mcqOpt('a', 'Traveling', 'Traveling'), mcqOpt('b', 'Double Dribble', 'Double Dribble'),
         mcqOpt('c', 'Charging', 'Charging'), mcqOpt('d', 'Blocking', 'Blocking')],
        'a'
      ),
      mcqItem(
        'ตำแหน่งไหนมักเป็นผู้เล่นตัวสูงที่สุดในทีม ยืนใกล้ห่วงที่สุด ทำหน้าที่รีบาวด์/บล็อก?', 'Which position is usually the tallest player, positioned closest to the basket, responsible for rebounds/blocks?',
        [mcqOpt('a', 'เซ็นเตอร์ (Center, C)', 'Center (C)'), mcqOpt('b', 'การ์ดจ่าย (Point Guard, PG)', 'Point Guard (PG)'),
         mcqOpt('c', 'การ์ดยิง (Shooting Guard, SG)', 'Shooting Guard (SG)'),
         mcqOpt('d', 'สมอลฟอร์เวิร์ด (Small Forward, SF)', 'Small Forward (SF)')],
        'a'
      ),
      mcqItem(
        'มุมยิงบาสเกตบอลที่แนะนำ (Ideal Shooting Arc) อยู่ที่ประมาณกี่องศา?', 'What is the recommended basketball shooting arc, roughly?',
        [mcqOpt('a', '45-52 องศา', '45-52 degrees'), mcqOpt('b', '10-20 องศา', '10-20 degrees'),
         mcqOpt('c', '70-80 องศา', '70-80 degrees'), mcqOpt('d', '0 องศา (เส้นตรงแบนราบ)', '0 degrees (a flat straight line)')],
        'a'
      )
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
      mcqItem(
        'วอลเลย์บอล 1 ทีมมีผู้เล่นกี่คนในสนาม?', 'How many players does one volleyball team have on the court?',
        [mcqOpt('a', '6 คน', '6 players'), mcqOpt('b', '5 คน', '5 players'),
         mcqOpt('c', '7 คน', '7 players'), mcqOpt('d', '4 คน', '4 players')],
        'a'
      ),
      mcqItem(
        'แต่ละทีมสัมผัสบอลได้สูงสุดกี่ครั้งต่อฝั่ง (ไม่นับบล็อก) ก่อนต้องส่งบอลข้ามตาข่าย?', 'How many times may a team touch the ball per side (not counting a block) before it must cross the net?',
        [mcqOpt('a', '3 ครั้ง', '3 times'), mcqOpt('b', '2 ครั้ง', '2 times'),
         mcqOpt('c', '4 ครั้ง', '4 times'), mcqOpt('d', '1 ครั้ง', '1 time')],
        'a'
      ),
      mcqItem(
        'การแข่งขันวอลเลย์บอลมาตรฐานเล่นแบบใด?', 'How is a standard volleyball match played?',
        [mcqOpt('a', 'Best of 5 เซต (ชนะ 3 ใน 5 เซต)', 'Best of 5 sets (first to win 3)'),
         mcqOpt('b', 'Best of 3 เซต', 'Best of 3 sets'),
         mcqOpt('c', 'เซตเดียวจบเกม', 'A single set decides the match'),
         mcqOpt('d', 'Best of 7 เซต', 'Best of 7 sets')],
        'a'
      ),
      mcqItem(
        'แต่ละเซต (ยกเว้นเซตตัดสิน) เล่นถึงกี่แต้ม?', 'How many points is each set (except the deciding set) played to?',
        [mcqOpt('a', '25 แต้ม', '25 points'), mcqOpt('b', '21 แต้ม', '21 points'),
         mcqOpt('c', '15 แต้ม', '15 points'), mcqOpt('d', '30 แต้ม', '30 points')],
        'a'
      ),
      mcqItem(
        'เซตตัดสิน (เซตที่ 5) เล่นถึงกี่แต้ม?', 'How many points is the deciding 5th set played to?',
        [mcqOpt('a', '15 แต้ม', '15 points'), mcqOpt('b', '25 แต้ม', '25 points'),
         mcqOpt('c', '21 แต้ม', '21 points'), mcqOpt('d', '10 แต้ม', '10 points')],
        'a'
      ),
      mcqItem(
        'การบล็อกนับเป็น 1 ใน 3 ครั้งสัมผัสบอลที่อนุญาตของทีมหรือไม่?', "Does a block count as one of the team's 3 allowed ball touches?",
        [mcqOpt('a', 'ไม่นับ — บล็อกแยกต่างหาก', 'No — a block is separate and does not count'),
         mcqOpt('b', 'นับเสมอ', 'Yes, it always counts'),
         mcqOpt('c', 'นับเฉพาะบล็อกเดี่ยว (คนเดียว)', 'Only counts for a solo block'),
         mcqOpt('d', 'แล้วแต่กรรมการตัดสิน', "It's up to the referee's discretion")],
        'a'
      ),
      mcqItem(
        'ทีมต้องหมุนตำแหน่งผู้เล่น 1 ตำแหน่งเมื่อใด?', 'When must a team rotate its players one position?',
        [mcqOpt('a', 'เมื่อได้สิทธิ์เสิร์ฟใหม่จากการเสียแต้มของฝ่ายตรงข้าม', "When it regains the serve after winning a point off the opponent's serve"),
         mcqOpt('b', 'ทุกจบเซต', 'At the end of every set'),
         mcqOpt('c', 'ทุก 5 แต้มที่ทำได้', 'Every 5 points scored'),
         mcqOpt('d', 'ไม่ต้องหมุนเลยตลอดเกม', 'Never — positions stay fixed all match')],
        'a'
      ),
      mcqItem(
        'ถ้าเสิร์ฟบอลออกนอกสนามหรือติดตาข่าย จะเกิดอะไรขึ้น?', 'What happens if a serve goes out of bounds or fails to cross the net?',
        [mcqOpt('a', 'ฝ่ายตรงข้ามได้แต้มทันที', 'The other team scores a point immediately'),
         mcqOpt('b', 'เสิร์ฟใหม่ได้อีกครั้งโดยไม่เสียอะไร', 'The server gets to retry with no penalty'),
         mcqOpt('c', 'ไม่มีผลอะไรเลย เล่นต่อปกติ', 'Nothing happens, play just continues'),
         mcqOpt('d', 'ทีมเสิร์ฟเสียสิทธิ์เสิร์ฟแต่ไม่เสียแต้ม', 'The serving team loses the serve but no point is scored')],
        'a'
      )
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
      mcqItem(
        'การแข่งขันแบดมินตันมาตรฐานเล่นแบบใด?', 'How is a standard badminton match played?',
        [mcqOpt('a', 'Best of 3 เกม (ชนะ 2 ใน 3 เกม)', 'Best of 3 games (first to win 2)'),
         mcqOpt('b', 'Best of 5 เกม', 'Best of 5 games'),
         mcqOpt('c', 'เกมเดียวจบการแข่งขัน', 'A single game decides the match'),
         mcqOpt('d', 'Best of 1 เกม', 'Best of 1 game')],
        'a'
      ),
      mcqItem(
        'แต่ละเกมเล่นถึงกี่แต้ม?', 'How many points is each game played to?',
        [mcqOpt('a', '21 แต้ม', '21 points'), mcqOpt('b', '25 แต้ม', '25 points'),
         mcqOpt('c', '15 แต้ม', '15 points'), mcqOpt('d', '11 แต้ม', '11 points')],
        'a'
      ),
      mcqItem(
        'ถ้าคะแนนเสมอ 29-29 แล้วใครถึง 30 ก่อน จะเกิดอะไรขึ้น?', 'If the score is tied 29-29, what happens when a player/team reaches 30 first?',
        [mcqOpt('a', 'ชนะเกมทันที (30 คือแต้มสูงสุด)', 'They win the game immediately (30 is the hard cap)'),
         mcqOpt('b', 'ต้องเล่นต่อจนนำห่าง 2 แต้ม ไม่มีเพดานแต้ม', 'Play continues until a 2-point lead, with no cap'),
         mcqOpt('c', 'เริ่มเกมใหม่ตั้งแต่ 0-0', 'The game restarts from 0-0'),
         mcqOpt('d', 'ไม่มีกติกาข้อนี้อยู่จริง', "No such rule exists")],
        'a'
      ),
      mcqItem(
        'ระบบคะแนนปัจจุบันของแบดมินตันเรียกว่าอะไร?', "What is badminton's current scoring system called?",
        [mcqOpt('a', 'Rally Point System — ได้แต้มทุกครั้งที่ชนะแรลลี่ ไม่ว่าใครเสิร์ฟ', 'Rally Point System — a point is scored on every rally, regardless of who served'),
         mcqOpt('b', 'Side-Out System — ต้องเป็นฝ่ายเสิร์ฟถึงจะได้แต้ม', 'Side-Out System — only the serving side can score'),
         mcqOpt('c', 'Golden Point System', 'Golden Point System'),
         mcqOpt('d', 'Tie-Break Only System', 'Tie-Break Only System')],
        'a'
      ),
      mcqItem(
        'การเสิร์ฟในแบดมินตันต้องตีลูกจากระดับไหน?', 'At what level must the shuttlecock be struck when serving in badminton?',
        [mcqOpt('a', 'ใต้เอว (Underarm) เท่านั้น', 'From below the waist (underarm) only'),
         mcqOpt('b', 'เหนือไหล่', 'Above the shoulder'),
         mcqOpt('c', 'ระดับไหนก็ได้ ไม่มีข้อจำกัด', 'Any height — there is no restriction'),
         mcqOpt('d', 'เหนือศีรษะเท่านั้น', 'Above the head only')],
        'a'
      ),
      mcqItem(
        'ถ้าเสิร์ฟผิดกติกา (เช่น ตีลูกเหนือเอว) เรียกว่าอะไรและเกิดผลอย่างไร?', 'What is it called (and what happens) when a serve breaks the rules (e.g. struck above the waist)?',
        [mcqOpt('a', 'Service Fault — เสียแต้มให้อีกฝ่ายทันที', 'Service Fault — the point goes to the other side immediately'),
         mcqOpt('b', 'Let — เสิร์ฟใหม่ได้โดยไม่เสียแต้ม', 'A Let — the serve is simply retaken with no point lost'),
         mcqOpt('c', 'ไม่มีผลอะไร เล่นต่อปกติ', 'Nothing happens, play continues normally'),
         mcqOpt('d', 'ผู้เล่นได้รับใบเหลือง', 'The player receives a yellow card')],
        'a'
      ),
      mcqItem(
        'ในประเภทคู่ เมื่อคะแนนของทีมเป็นเลขคู่ ต้องเสิร์ฟจากช่องไหน?', "In doubles, when a team's score is an even number, which service court must they serve from?",
        [mcqOpt('a', 'ช่องขวา', 'The right service court'), mcqOpt('b', 'ช่องซ้าย', 'The left service court'),
         mcqOpt('c', 'ช่องไหนก็ได้', 'Either court, it does not matter'),
         mcqOpt('d', 'ต้องเสิร์ฟจากกลางสนาม', 'From the middle of the court')],
        'a'
      ),
      mcqItem(
        'ถ้าลูกขนไก่โดนตัวผู้เล่นก่อนตกพื้น จะเกิดอะไรขึ้น?', "What happens if the shuttlecock touches a player's body before hitting the ground?",
        [mcqOpt('a', 'อีกฝ่ายได้แต้มทันที', 'The other side scores the point immediately'),
         mcqOpt('b', 'เสิร์ฟใหม่ ไม่มีใครได้แต้ม', 'The serve is retaken, no point is awarded'),
         mcqOpt('c', 'ไม่มีผลอะไรเลย', 'Nothing happens at all'),
         mcqOpt('d', 'หยุดเกมชั่วคราวเพื่อตรวจสอบ', 'Play is paused for a review')],
        'a'
      )
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
      mcqItem(
        'ในเกมเทนนิส ถ้าผู้เล่นทำแต้มได้ 2 แต้มแล้ว คะแนนจะถูกเรียกว่าอะไร?', "In a tennis game, what is the score called after a player has won 2 points?",
        [mcqOpt('a', '30', '30'), mcqOpt('b', '15', '15'),
         mcqOpt('c', '40', '40'), mcqOpt('d', 'Love', 'Love')],
        'a'
      ),
      mcqItem(
        'ถ้าทั้งสองฝ่ายมีคะแนน 40-40 เท่ากัน เรียกว่าอะไร?', 'What is it called when both sides are tied at 40-40?',
        [mcqOpt('a', 'Deuce', 'Deuce'), mcqOpt('b', 'Tie-Break', 'Tie-Break'),
         mcqOpt('c', 'Match Point', 'Match Point'), mcqOpt('d', 'Let', 'Let')],
        'a'
      ),
      mcqItem(
        'ผู้เล่น/ทีมที่ชนะ 6 เกมก่อน (นำห่างอย่างน้อย 2 เกม) จะเป็นผู้ชนะอะไร?', 'The player/team who wins 6 games first (by a margin of at least 2) wins what?',
        [mcqOpt('a', 'เซต (Set)', 'The Set'), mcqOpt('b', 'แมตช์ทั้งหมดทันที', 'The entire match immediately'),
         mcqOpt('c', 'แค่เกมเดียว', 'Just a single game'), mcqOpt('d', 'ทัวร์นาเมนต์', 'The whole tournament')],
        'a'
      ),
      mcqItem(
        'การแข่งขันเทนนิสมาตรฐานทั่วไปเล่นแบบใด?', 'How is a typical standard tennis match played?',
        [mcqOpt('a', 'Best of 3 เซต', 'Best of 3 sets'), mcqOpt('b', 'Best of 5 เซตเสมอทุกครั้ง', 'Always best-of-5 sets'),
         mcqOpt('c', 'เซตเดียวจบการแข่งขัน', 'A single set decides the match'),
         mcqOpt('d', 'Best of 1 เซต', 'Best of 1 set')],
        'a'
      ),
      mcqItem(
        'ถ้าเสิร์ฟผิดพลาด 2 ครั้งติดกัน (Double Fault) จะเกิดอะไรขึ้น?', 'What happens on a Double Fault (two consecutive serve faults)?',
        [mcqOpt('a', 'เสียแต้มให้อีกฝ่ายทันที', 'The point immediately goes to the other side'),
         mcqOpt('b', 'เสิร์ฟใหม่ได้อีกครั้งโดยไม่เสียอะไร', 'The server gets to retry with no penalty'),
         mcqOpt('c', 'เปลี่ยนฝั่งเสิร์ฟไปให้อีกฝ่ายทั้งเกม', 'Serve permanently switches to the other side for the rest of the game'),
         mcqOpt('d', 'ไม่มีผลอะไรเลย', 'Nothing happens at all')],
        'a'
      ),
      mcqItem(
        'ถ้าเสิร์ฟโดนตาข่ายแต่ยังตกในช่องเสิร์ฟที่ถูกต้อง เรียกว่าอะไร?', 'What is it called when a serve touches the net but still lands in the correct service box?',
        [mcqOpt('a', 'Let', 'Let'), mcqOpt('b', 'Fault', 'Fault'),
         mcqOpt('c', 'Deuce', 'Deuce'), mcqOpt('d', 'Ace', 'Ace')],
        'a'
      ),
      mcqItem(
        'ผู้เล่นยอมให้บอลเด้งพื้นฝั่งตัวเองได้กี่ครั้งก่อนต้องตีกลับ?', 'How many times is a player allowed to let the ball bounce on their side before returning it?',
        [mcqOpt('a', '1 ครั้ง', '1 time'), mcqOpt('b', '2 ครั้ง', '2 times'),
         mcqOpt('c', 'ไม่ให้เด้งเลย ต้องตีก่อนตกพื้น', 'None — must be hit before touching the ground'),
         mcqOpt('d', '3 ครั้ง', '3 times')],
        'a'
      ),
      mcqItem(
        'ถ้าคะแนนเกมในเซตเสมอ 6-6 มักใช้ระบบใดตัดสินเซตนั้น?', 'When the game score in a set reaches 6-6, what system usually decides the set?',
        [mcqOpt('a', 'Tie-Break', 'A Tie-Break'), mcqOpt('b', 'Deuce', 'Deuce'),
         mcqOpt('c', 'Golden Point', 'Golden Point'), mcqOpt('d', 'Sudden Death', 'Sudden Death')],
        'a'
      )
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
      quizWrap = $('quizWrap'), quizPromptEl = $('quizPrompt'),
      answerRow = $('answerRow'), markReadBtn = $('markReadBtn'), resultBanner = $('resultBanner'),
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

  function itemLabel(track, item, i) {
    if (item.kind === 'reading') return pick(item.heading);
    var quizNum = 0;
    for (var k = 0; k <= i; k++) if (track.items[k].kind === 'quiz') quizNum++;
    return (getUILang() === 'en' ? 'Question ' : 'ข้อที่ ') + quizNum;
  }

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
      btn.textContent = (passed ? '✅ ' : unlocked ? (item.kind === 'reading' ? '📖 ' : '❓ ') : '🔒 ') + itemLabel(track, item, i);
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

    if (item.kind === 'reading') {
      itemHeading.textContent = pick(item.heading);
      instructionsBox.innerHTML = pick(item.body).map(function (p) { return '<p>' + p + '</p>'; }).join('');
      if (item.diagram) instructionsBox.innerHTML += item.diagram;
      quizWrap.style.display = 'none';
      markReadBtn.style.display = 'inline-flex';
      markReadBtn.disabled = false;
    } else {
      itemHeading.textContent = itemLabel(track, item, idx);
      instructionsBox.innerHTML = '';
      quizWrap.style.display = 'block';
      markReadBtn.style.display = 'none';
      quizPromptEl.textContent = pick(item.prompt);
      renderAnswerRow(item);
    }

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

  function renderAnswerRow(item) {
    answerRow.innerHTML = '';
    var progress = loadProgress();
    var track = trackById(state.trackId);
    var idx = state.itemIndex;
    var alreadyPassed = !!progress[progressKey(track.id, idx)];
    item.options.forEach(function (opt) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sp-answer-btn';
      btn.textContent = pick(opt.label);
      if (alreadyPassed) {
        btn.disabled = true;
        if (opt.key === item.answer) btn.classList.add('correct');
      }
      btn.addEventListener('click', function () { handleAnswer(item, opt.key, btn); });
      answerRow.appendChild(btn);
    });
  }

  function handleAnswer(item, choice, btnEl) {
    if (choice === item.answer) {
      Array.prototype.forEach.call(answerRow.children, function (b) { b.disabled = true; });
      btnEl.classList.add('correct');
      resultBanner.textContent = t('correctMsg');
      resultBanner.className = 'sp-result-banner pass';
      resultBanner.style.display = 'block';

      var trackIdx = TRACKS.indexOf(trackById(state.trackId));
      passItem(trackIdx, state.itemIndex);

      var track = TRACKS[trackIdx];
      var isLast = state.itemIndex === track.items.length - 1;
      if (!isLast) {
        setTimeout(function () { selectItem(state.itemIndex + 1); }, 900);
      } else {
        resultBanner.textContent = t('trackDoneMsg');
      }
    } else {
      btnEl.classList.add('wrong');
      setTimeout(function () { btnEl.classList.remove('wrong'); }, 400);
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
