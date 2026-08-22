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
function readingItem(headingTh, headingEn, paragraphsTh, paragraphsEn) {
  return { kind: 'reading', heading: { th: headingTh, en: headingEn }, body: { th: paragraphsTh, en: paragraphsEn } };
}
function mcqOpt(key, th, en) { return { key: key, label: { th: th, en: en } }; }
function mcqItem(promptTh, promptEn, options, answer) {
  return { kind: 'quiz', prompt: { th: promptTh, en: promptEn }, options: options, answer: answer };
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
