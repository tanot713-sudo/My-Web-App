/* ══════════════════════════════════════════════════════════════════
   Tanot — typing.js
   สอนพิมพ์สัมผัส (touch typing) ไทย/อังกฤษ: บทเรียนไล่ระดับ (แถวกลาง → คีย์บอร์ดเต็ม →
   คำศัพท์ → ประโยค) วัดความเร็ว (WPM) และความแม่นยำแบบ real-time พร้อมคีย์บอร์ดเสมือน
   ไฮไลต์ปุ่มที่ต้องกดถัดไป — ประมวลผลทั้งหมดในเบราว์เซอร์ ไม่มีอะไรถูกอัปโหลดขึ้นเซิร์ฟเวอร์

   ⚠️ ขอบเขตสำคัญของบทเรียนภาษาไทย: ใช้เฉพาะตัวอักษรที่อยู่ "แป้นไม่กด Shift" ของผังแป้นพิมพ์
   เกษมณี (Kedmanee) เท่านั้น — แป้น Shift ของผังนี้มีอักษร/สระ/วรรณยุกต์อีกชุดหนึ่ง (เช่น โ ศ ษ ฮ
   ฯลฯ) ซึ่งไม่ได้ตรวจทานตำแหน่งละเอียดพอจะยืนยันความถูกต้อง 100% จึงตัดออกจากขอบเขตเฟสนี้
   ไปก่อน (กันสอนข้อมูลผิดเรื่องตำแหน่งแป้นซึ่งเป็นเรื่องที่ตรวจสอบได้ง่ายถ้าพลาด) — คำศัพท์ที่เลือก
   มาทั้งหมดในไฟล์นี้ตรวจสอบแล้วว่าประกอบด้วยตัวอักษรที่ไม่ต้องกด Shift ล้วนๆ
   ══════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

/* ══════════════════════════════════════════════════════════════════
   ผังแป้นพิมพ์ (สำหรับวาดคีย์บอร์ดเสมือน + หาตำแหน่งปุ่มที่ต้องกดถัดไป)
   แต่ละปุ่ม = [en, th] (อักษรที่ได้เมื่อกดแป้นนี้แบบไม่กด Shift)
   ══════════════════════════════════════════════════════════════════ */
var KB_ROWS = [
  [['`','_'],['1','ๅ'],['2','/'],['3','-'],['4','ภ'],['5','ถ'],['6','ุ'],['7','ึ'],['8','ค'],['9','ต'],['0','จ'],['-','ข'],['=','ช']],
  [['q','ๆ'],['w','ไ'],['e','ำ'],['r','พ'],['t','ะ'],['y','ั'],['u','ี'],['i','ร'],['o','น'],['p','ย'],['[','บ'],[']','ล']],
  [['a','ฟ'],['s','ห'],['d','ก'],['f','ด'],['g','เ'],['h','้'],['j','่'],['k','า'],['l','ส'],[';','ว'],["'",'ง']],
  [['z','ผ'],['x','ป'],['c','แ'],['v','อ'],['b','ิ'],['n','ื'],['m','ท'],[',','ม'],['.','ใ'],['/','ฝ']]
];
var HOME_COLS = { 2: [0,1,2,3,8,9,10] }; /* แถวที่ 3 (index 2) คือแถวกลาง — คอลัมน์ a s d f ; ' ก็ยังนับ แต่ปุ่มบ้านจริงๆ คือ a s d f j k l ; (ดูด้านล่าง) */
var HOME_KEYS_EN = ['a','s','d','f','j','k','l',';'];

/* ตารางย้อนกลับ: อักษร -> ตำแหน่งปุ่ม {r,c} — ใช้หาว่าอักษรถัดไปที่ต้องพิมพ์อยู่ปุ่มไหน */
function buildCharMap(layoutIdx) {
  var map = {};
  KB_ROWS.forEach(function (row, r) {
    row.forEach(function (key, c) {
      map[key[layoutIdx]] = { r: r, c: c };
    });
  });
  map[' '] = { space: true };
  return map;
}
var EN_CHAR_MAP = buildCharMap(0);
var TH_CHAR_MAP = buildCharMap(1);

/* ══════════════════════════════════════════════════════════════════
   บทเรียน — แบ่งเป็น track (ไทย/อังกฤษ x แถวกลาง/คีย์บอร์ดเต็ม/คำศัพท์/ประโยค)
   ══════════════════════════════════════════════════════════════════ */
var TRACKS = [
  {
    id: 'en-home', lang: 'en', label: 'แถวกลาง', labelEn: 'Home Row',
    desc: 'วางนิ้วบนแป้น A S D F (มือซ้าย) และ J K L ; (มือขวา) — ปุ่ม F กับ J มีปุ่มนูนเล็กๆ ให้คลำหาได้โดยไม่ต้องมอง',
    lessons: [
      { title: 'พื้นฐาน a s d f', text: 'asdf asdf asdf fdsa fdsa asdf jaaa' },
      { title: 'พื้นฐาน j k l ;', text: 'jkl; jkl; jkl; ;lkj ;lkj jkl; fjjj' },
      { title: 'รวมสองมือ', text: 'asdf jkl; asdf jkl; fj fj dk dk sl sl a; a;' },
      { title: 'คำสั้นแถวกลาง', text: 'ask fall lads salad flask alas add jak' },
      { title: 'ประโยคแถวกลาง', text: 'a sad lad asks a lass; a flask falls; add salad' }
    ]
  },
  {
    id: 'en-full', lang: 'en', label: 'คีย์บอร์ดเต็ม', labelEn: 'Full Keyboard',
    desc: 'เริ่มขยับนิ้วขึ้น-ลงจากแถวกลางไปแตะแถวบน/ล่าง แล้วรีบกลับมาที่แถวกลางเสมอ',
    lessons: [
      { title: 'แถวบน q-p', text: 'qwert yuiop qwert yuiop trewq poiuy' },
      { title: 'แถวล่าง z-/', text: 'zxcvb nm,./ zxcvb nm,./ bvcxz /.,mn' },
      { title: 'รวมทุกแถว', text: 'the quick brown fox jumps over the lazy dog' },
      { title: 'ฝึกความแม่นยำ', text: 'we type fast and accurate every single day' },
      { title: 'ฝึกความเร็ว', text: 'practice makes perfect when you type daily without looking down' }
    ]
  },
  {
    id: 'en-words', lang: 'en', label: 'คำศัพท์', labelEn: 'Common Words',
    desc: 'คำที่ใช้บ่อยที่สุดในภาษาอังกฤษ — พิมพ์คล่องกลุ่มนี้แล้วจะพิมพ์ประโยคทั่วไปได้เร็วขึ้นมาก',
    lessons: [
      { title: 'คำศัพท์ชุด 1', text: 'the of and a to in is you that it he was for on are' },
      { title: 'คำศัพท์ชุด 2', text: 'as with his they at be this from have or one had by word' },
      { title: 'คำศัพท์ชุด 3', text: 'but not what all were we when your can said there use each' }
    ]
  },
  {
    id: 'en-sentences', lang: 'en', label: 'ประโยค', labelEn: 'Sentences',
    desc: 'ประโยคสั้นๆ ที่ใช้ตัวอักษรครบทุกแถว ฝึกความลื่นไหลตอนเปลี่ยนคำ',
    lessons: [
      { title: 'ประโยคที่ 1', text: 'Practice typing every day to become faster and more accurate.' },
      { title: 'ประโยคที่ 2', text: 'A good typist keeps their eyes on the screen, not the keyboard.' },
      { title: 'ประโยคที่ 3', text: 'Learning to touch type will save you time in the long run.' },
      { title: 'ประโยคที่ 4', text: 'Speed comes naturally once accuracy becomes a habit.' },
      { title: 'ประโยคที่ 5', text: 'Take a short break if your fingers start to feel tired.' }
    ]
  },
  {
    id: 'th-home', lang: 'th', label: 'แถวกลาง (ไทย)', labelEn: 'Home Row (Thai)',
    desc: '⚠️ สลับคีย์บอร์ดเป็นภาษาไทยก่อนเริ่ม — วางนิ้วบนแป้นเดียวกับอังกฤษ (A S D F / J K L ;) แต่จะพิมพ์ได้อักษรไทยแทน',
    lessons: [
      { title: 'พื้นฐาน ฟ ห ก ด', text: 'ฟหกด ฟหกด ฟหกด ดกหฟ ฟหกด' },
      { title: 'พื้นฐาน ่ า ส ว', text: 'ก่า ห่า ด่า ส่า ก่า ห่า ว่า ว่า' },
      { title: 'รวมสองมือ', text: 'ฟหกด ่าสว กา หา ดา ดาว หาก สาก ฟาก ว่า ด่า' },
      { title: 'เติมแป้นชิด (เ ้ ง)', text: 'เกา เดา เสา เงา ก้า ห้า ด้า ส้า' },
      { title: 'ทบทวนแถวกลาง', text: 'กา หา ดาว สาก ฟาก เกา เดา ก้า ห้า ว่า ด่า เงา' }
    ]
  },
  {
    id: 'th-full', lang: 'th', label: 'คีย์บอร์ดเต็ม (ไทย)', labelEn: 'Full Keyboard (Thai)',
    desc: '⚠️ สลับคีย์บอร์ดเป็นภาษาไทยก่อนเริ่ม — ขยับนิ้วขึ้นแถวบน (ๆ ไ ำ พ ะ ั ี ร น ย บ ล) และลงแถวล่าง (ผ ป แ อ ิ ื ท ม ใ ฝ)',
    lessons: [
      { title: 'แถวบน', text: 'ไป มา ไทย นก บาน รัก บัว ปี น้ำ' },
      { title: 'แถวล่าง', text: 'มือ ทะเล แดด ฝน ใจ อาหาร ปลา แปะ' },
      { title: 'คำในชีวิตประจำวัน', text: 'กิน ดี ไป น้ำ บ้าน รัก สวย หนัง อาหาร เพื่อน' },
      { title: 'คำสองพยางค์', text: 'ครอบครัว ทะเล แดดจ้า สวยงาม เพื่อนบ้าน หนังสือ' },
      { title: 'ทบทวนทุกแถว', text: 'วันนี้ฝนตก เพื่อนชวนไปกินอาหารทะเล ที่บ้านมีแมวสวย' }
    ]
  },
  {
    id: 'th-words', lang: 'th', label: 'คำศัพท์ (ไทย)', labelEn: 'Common Words (Thai)',
    desc: 'คำไทยที่ใช้บ่อยในชีวิตประจำวัน (เลือกเฉพาะคำที่พิมพ์ได้โดยไม่ต้องกด Shift)',
    lessons: [
      { title: 'คำศัพท์ชุด 1', text: 'กิน นอน ดู ฟัง พูด เดิน วิ่ง ทำ มา ไป อยู่ ยืน นั่ง' },
      { title: 'คำศัพท์ชุด 2', text: 'บ้าน รถ น้ำ ไฟ ข้าว ปลา ผัก ผลไม้ เสื้อ กางเกง' },
      { title: 'คำศัพท์ชุด 3', text: 'พ่อ แม่ พี่ น้อง เพื่อน ครู หมอ ตำรวจ ทหาร คนขับรถ' }
    ]
  },
  {
    id: 'th-sentences', lang: 'th', label: 'ประโยค (ไทย)', labelEn: 'Sentences (Thai)',
    desc: 'ประโยคสั้นๆ ที่ใช้ได้จริง (คัดเฉพาะประโยคที่ไม่มีตัวอักษรต้องกด Shift)',
    lessons: [
      { title: 'ประโยคที่ 1', text: 'วันนี้อากาศดีมาก เหมาะแก่การไปเที่ยวทะเล' },
      { title: 'ประโยคที่ 2', text: 'ฝึกพิมพ์ดีดทุกวันจะช่วยให้พิมพ์ได้เร็วและแม่นยำขึ้น' },
      { title: 'ประโยคที่ 3', text: 'เพื่อนบ้านชวนไปกินอาหารทะเลที่ร้านใหม่ริมทะเล' },
      { title: 'ประโยคที่ 4', text: 'ครอบครัวของฉันชอบไปเที่ยวทะเลกันทุกปี' },
      { title: 'ประโยคที่ 5', text: 'อย่าลืมวางนิ้วบนแป้นกลางแล้วมองจอ ไม่ต้องมองแป้นพิมพ์' }
    ]
  }
];

function trackById(id) {
  for (var i = 0; i < TRACKS.length; i++) if (TRACKS[i].id === id) return TRACKS[i];
  return TRACKS[0];
}

/* ══════════════════════════════════════════════════════════════════
   บันทึกความคืบหน้า (WPM/ความแม่นยำที่ดีที่สุดต่อบทเรียน)
   ══════════════════════════════════════════════════════════════════ */
var PROGRESS_KEY = 'tanot:typing:progress';
function loadProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; } catch (e) { return {}; }
}
function saveProgress(p) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch (e) {}
}
function progressKey(trackId, lessonIdx) { return trackId + '::' + lessonIdx; }

/* ══════════════════════════════════════════════════════════════════
   ภาษา UI (ไทย/อังกฤษ) — คนละ key กับหน้าอื่น (แต่ละหน้าเก็บของตัวเอง ดูเหตุผลเดียวกับ doc-check.js)
   ══════════════════════════════════════════════════════════════════ */
var UI_LANG_KEY = 'tanot:typinglang';
function getUILang() {
  try { return localStorage.getItem(UI_LANG_KEY) === 'en' ? 'en' : 'th'; } catch (e) { return 'th'; }
}
function setUILang(l) { try { localStorage.setItem(UI_LANG_KEY, l); } catch (e) {} }

var I18N = {
  th: {
    pageTitle: 'สอนพิมพ์', pageDesc: 'ฝึกพิมพ์สัมผัสไทย/อังกฤษ ไล่ระดับตั้งแต่แถวกลางจนถึงประโยคเต็ม วัดความเร็ว (WPM) และความแม่นยำแบบสด — ทำงานในเบราว์เซอร์ของคุณทั้งหมด',
    crumbResp: 'งานที่รับผิดชอบ', crumbTyping: 'สอนพิมพ์',
    statsWpm: 'คำ/นาที', statsAcc: 'ความแม่นยำ', statsTime: 'เวลา',
    resultTitle: 'จบบทเรียนแล้ว!', resultWpm: 'ความเร็ว', resultAcc: 'ความแม่นยำ', resultBest: 'สถิติที่ดีที่สุด',
    btnRetry: 'ฝึกซ้ำ', btnNext: 'บทถัดไป', btnRestartHint: 'พิมพ์เพื่อเริ่มบทเรียน',
    thaiKbHint: '⚠️ อย่าลืมสลับคีย์บอร์ดเป็นภาษาไทยก่อนเริ่มพิมพ์',
    clickToFocus: 'คลิกที่นี่เพื่อเริ่มพิมพ์'
  },
  en: {
    pageTitle: 'Typing Tutor', pageDesc: 'Practice touch typing in Thai/English, progressing from the home row to full sentences. Live WPM and accuracy tracking — everything runs in your browser.',
    crumbResp: 'Responsibilities', crumbTyping: 'Typing Tutor',
    statsWpm: 'WPM', statsAcc: 'Accuracy', statsTime: 'Time',
    resultTitle: 'Lesson complete!', resultWpm: 'Speed', resultAcc: 'Accuracy', resultBest: 'Best score',
    btnRetry: 'Retry', btnNext: 'Next Lesson', btnRestartHint: 'Start typing to begin',
    thaiKbHint: '⚠️ Remember to switch your keyboard to Thai before you start typing',
    clickToFocus: 'Click here to start typing'
  }
};
function t(key) { var l = getUILang(); return (I18N[l] && I18N[l][key]) || I18N.th[key] || key; }

/* ══════════════════════════════════════════════════════════════════
   UI wiring
   ══════════════════════════════════════════════════════════════════ */
if (typeof document !== 'undefined' && document.getElementById('typingRoot')) {
  var $ = function (id) { return document.getElementById(id); };
  var trackTabs = $('trackTabs'), lessonList = $('lessonList'), practiceText = $('practiceText'),
      hiddenInput = $('hiddenInput'), kbEl = $('virtualKeyboard'), statWpm = $('statWpm'),
      statAcc = $('statAcc'), statTime = $('statTime'), resultPanel = $('resultPanel'),
      resultWpmEl = $('resultWpm'), resultAccEl = $('resultAcc'), resultBestEl = $('resultBest'),
      retryBtn = $('retryBtn'), nextBtn = $('nextBtn'), practiceArea = $('practiceArea'),
      langToggle = $('langToggle'), trackDesc = $('trackDesc'), focusHint = $('focusHint'),
      thaiKbHint = $('thaiKbHint');

  var state = {
    trackId: 'en-home', lessonIndex: 0, target: '', charStatus: [], attempted: [],
    startTime: null, keystrokes: 0, mistakes: 0, finished: false, timerId: null
  };

  function applyI18n() {
    document.documentElement.lang = getUILang();
    document.title = t('pageTitle') + ' | Tanot';
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    if (langToggle) {
      langToggle.querySelectorAll('span').forEach(function (span) {
        span.classList.toggle('active', span.getAttribute('data-lt') === getUILang());
      });
    }
  }

  function renderTrackTabs() {
    trackTabs.innerHTML = '';
    TRACKS.forEach(function (tr) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tt-tab' + (tr.id === state.trackId ? ' active' : '');
      btn.textContent = getUILang() === 'en' ? tr.labelEn : tr.label;
      btn.addEventListener('click', function () { selectTrack(tr.id); });
      trackTabs.appendChild(btn);
    });
  }

  function renderLessonList() {
    var track = trackById(state.trackId);
    var progress = loadProgress();
    lessonList.innerHTML = '';
    track.lessons.forEach(function (lesson, i) {
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'tt-lesson' + (i === state.lessonIndex ? ' active' : '');
      var best = progress[progressKey(track.id, i)];
      item.innerHTML = '<span class="tt-lesson-title">' + (i + 1) + '. ' + lesson.title + '</span>' +
        (best ? '<span class="tt-lesson-best">' + Math.round(best.wpm) + ' ' + t('statsWpm') + '</span>' : '');
      item.addEventListener('click', function () { selectLesson(i); });
      lessonList.appendChild(item);
    });
  }

  function selectTrack(trackId) {
    state.trackId = trackId;
    state.lessonIndex = 0;
    renderTrackTabs();
    renderLessonList();
    var track = trackById(trackId);
    trackDesc.textContent = track.desc;
    thaiKbHint.style.display = track.lang === 'th' ? 'flex' : 'none';
    startLesson();
  }

  function selectLesson(idx) {
    state.lessonIndex = idx;
    renderLessonList();
    startLesson();
  }

  function startLesson() {
    var track = trackById(state.trackId);
    var lesson = track.lessons[state.lessonIndex];
    state.target = lesson.text;
    state.charStatus = new Array(state.target.length).fill('pending');
    state.attempted = new Array(state.target.length).fill(false);
    state.startTime = null;
    state.keystrokes = 0;
    state.mistakes = 0;
    state.finished = false;
    hiddenInput.value = '';
    resultPanel.style.display = 'none';
    practiceArea.classList.remove('done');
    clearInterval(state.timerId);
    statWpm.textContent = '0';
    statAcc.textContent = '100%';
    statTime.textContent = '0s';
    renderPracticeText();
    renderKeyboard(track.lang);
    highlightNextKey(track.lang);
    hiddenInput.focus();
  }

  function renderPracticeText() {
    practiceText.innerHTML = '';
    for (var i = 0; i < state.target.length; i++) {
      var span = document.createElement('span');
      span.className = 'tt-char ' + state.charStatus[i] + (i === hiddenInput.value.length ? ' cursor' : '');
      span.textContent = state.target[i];
      practiceText.appendChild(span);
    }
  }

  function renderKeyboard(lang) {
    kbEl.innerHTML = '';
    KB_ROWS.forEach(function (row, r) {
      var rowEl = document.createElement('div');
      rowEl.className = 'tt-kbrow';
      row.forEach(function (key, c) {
        var keyEl = document.createElement('div');
        var isHome = r === 2 && HOME_KEYS_EN.indexOf(key[0]) !== -1;
        keyEl.className = 'tt-key' + (isHome ? ' home' : '');
        keyEl.dataset.r = r; keyEl.dataset.c = c;
        keyEl.textContent = key[lang === 'th' ? 1 : 0];
        rowEl.appendChild(keyEl);
      });
      kbEl.appendChild(rowEl);
    });
    var spaceRow = document.createElement('div');
    spaceRow.className = 'tt-kbrow';
    var spaceKey = document.createElement('div');
    spaceKey.className = 'tt-key tt-space';
    spaceKey.dataset.space = '1';
    spaceRow.appendChild(spaceKey);
    kbEl.appendChild(spaceRow);
  }

  function highlightNextKey(lang) {
    kbEl.querySelectorAll('.tt-key').forEach(function (k) { k.classList.remove('next'); });
    var nextChar = state.target[hiddenInput.value.length];
    if (nextChar === undefined) return;
    if (nextChar === ' ') {
      var sp = kbEl.querySelector('.tt-space');
      if (sp) sp.classList.add('next');
      return;
    }
    var map = lang === 'th' ? TH_CHAR_MAP : EN_CHAR_MAP;
    var pos = map[nextChar];
    if (!pos || pos.space) return;
    var keyEl = kbEl.querySelector('.tt-key[data-r="' + pos.r + '"][data-c="' + pos.c + '"]');
    if (keyEl) keyEl.classList.add('next');
  }

  function liveStats() {
    if (!state.startTime) return;
    var minutes = (Date.now() - state.startTime) / 60000;
    var wpm = minutes > 0 ? Math.round((state.keystrokes / 5) / minutes) : 0;
    var acc = state.keystrokes > 0 ? Math.round(((state.keystrokes - state.mistakes) / state.keystrokes) * 100) : 100;
    statWpm.textContent = String(wpm);
    statAcc.textContent = acc + '%';
    statTime.textContent = Math.round((Date.now() - state.startTime) / 1000) + 's';
  }

  function finishLesson() {
    state.finished = true;
    clearInterval(state.timerId);
    var minutes = (Date.now() - state.startTime) / 60000;
    var wpm = minutes > 0 ? (state.keystrokes / 5) / minutes : 0;
    var acc = state.keystrokes > 0 ? ((state.keystrokes - state.mistakes) / state.keystrokes) * 100 : 100;

    var progress = loadProgress();
    var key = progressKey(state.trackId, state.lessonIndex);
    var prevBest = progress[key];
    var isNewBest = !prevBest || wpm > prevBest.wpm;
    if (isNewBest) progress[key] = { wpm: wpm, acc: acc, at: Date.now() };
    saveProgress(progress);

    resultWpmEl.textContent = Math.round(wpm);
    resultAccEl.textContent = Math.round(acc) + '%';
    resultBestEl.textContent = Math.round((progress[key] || { wpm: wpm }).wpm) + ' ' + t('statsWpm');
    resultPanel.style.display = 'flex';
    practiceArea.classList.add('done');
    renderLessonList();
  }

  hiddenInput.addEventListener('input', function () {
    if (state.finished) return;
    if (!state.startTime) {
      state.startTime = Date.now();
      state.timerId = setInterval(liveStats, 500);
    }
    var val = hiddenInput.value;
    /* จำกัดไม่ให้พิมพ์เกินความยาวเป้าหมาย (กันเลย index ตอนคำนวณ) */
    if (val.length > state.target.length) {
      val = val.slice(0, state.target.length);
      hiddenInput.value = val;
    }
    for (var i = 0; i < val.length; i++) {
      if (!state.attempted[i]) {
        state.attempted[i] = true;
        state.keystrokes++;
        if (val[i] !== state.target[i]) state.mistakes++;
      }
      state.charStatus[i] = val[i] === state.target[i] ? 'correct' : 'wrong';
    }
    for (var j = val.length; j < state.target.length; j++) state.charStatus[j] = 'pending';

    renderPracticeText();
    var track = trackById(state.trackId);
    highlightNextKey(track.lang);
    liveStats();

    if (val.length === state.target.length) finishLesson();
  });

  practiceArea.addEventListener('click', function () { hiddenInput.focus(); });
  hiddenInput.addEventListener('focus', function () { focusHint.style.display = 'none'; });
  hiddenInput.addEventListener('blur', function () { if (!state.finished) focusHint.style.display = 'block'; });

  retryBtn.addEventListener('click', startLesson);
  nextBtn.addEventListener('click', function () {
    var track = trackById(state.trackId);
    if (state.lessonIndex < track.lessons.length - 1) selectLesson(state.lessonIndex + 1);
    else startLesson();
  });

  if (langToggle) {
    langToggle.addEventListener('click', function () {
      setUILang(getUILang() === 'en' ? 'th' : 'en');
      applyI18n();
      renderTrackTabs();
      renderLessonList();
      var track = trackById(state.trackId);
      trackDesc.textContent = track.desc;
    });
  }

  applyI18n();
  selectTrack(state.trackId);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TRACKS: TRACKS, KB_ROWS: KB_ROWS };
}
})();
