/* ══════════════════════════════════════════════════════════════════
   Tanot — เรียนดนตรี (music.js)
   สเตจ 1: ทฤษฎีดนตรีพื้นฐาน + การอ่านโน้ตสากลบนกุญแจซอล
   สถาปัตยกรรมก็อป-แล้วปรับจาก coding.js (แถบเกม/เมนูแฮมเบอร์เกอร์/sidebar ล็อกลำดับ/i18n TH-EN)
   ต่างตรงที่ไม่มีตัวแก้ไขโค้ด — แต่ละ item เป็น 'reading' (เนื้อหาอ่านอย่างเดียว กดปุ่มเพื่อไปต่อ)
   หรือ 'quiz' (โจทย์แบบเลือกตอบ ตอบถูกถึงปลดล็อกข้อถัดไป) แทน
   ══════════════════════════════════════════════════════════════════ */
'use strict';

/* ══════════════════════════════════════════════════════════════════
   i18n
   ══════════════════════════════════════════════════════════════════ */
var UI_LANG_KEY = 'tanot:musiclang';
function getUILang() { try { return localStorage.getItem(UI_LANG_KEY) === 'en' ? 'en' : 'th'; } catch (e) { return 'th'; } }
function setUILang(l) { try { localStorage.setItem(UI_LANG_KEY, l); } catch (e) {} }
function pick(obj) { return obj ? (getUILang() === 'en' ? obj.en : obj.th) : ''; }

var I18N = {
  th: {
    pageTitle: 'เรียนดนตรี', crumbResp: 'งานที่รับผิดชอบ', crumbMusic: 'เรียนดนตรี',
    markReadBtn: '✓ เข้าใจแล้ว ไปต่อ',
    lockedMsg: 'บทเรียนนี้ยังล็อกอยู่ — ทำข้อก่อนหน้าให้ผ่านก่อน',
    quizPromptTreble: 'โน้ตตัวนี้บนกุญแจซอลคือตัวอะไร?',
    quizPromptBass: 'โน้ตตัวนี้บนกุญแจฟาคือตัวอะไร?',
    quizPromptValue: 'โน้ตตัวนี้คือโน้ตอะไร (มีกี่จังหวะ ในจังหวะ 4/4)?',
    quizPromptTimeSigBeats: 'จังหวะนี้มีกี่จังหวะต่อห้อง (beats per measure)?',
    quizPromptTimeSigUnit: 'โน้ตตัวไหนได้ 1 จังหวะ ในจังหวะนี้?',
    quizPromptScaleDegree: 'โน้ตตัวที่ {degree} ในบันไดเสียง C เมเจอร์ คือตัวอะไร?',
    quizPromptChordQuality: 'คอร์ดนี้เป็นเมเจอร์หรือไมเนอร์?',
    quizPromptChordRoot: 'คอร์ดนี้มีโน้ตรากเป็นตัวอะไร (root)?',
    quizPromptPianoNote: 'คีย์เปียโนที่ไฮไลต์อยู่คือโน้ตอะไร?',
    quizPromptPianoChordQuality: 'คอร์ดที่กดอยู่บนเปียโนนี้เป็นเมเจอร์หรือไมเนอร์?',
    quizPromptPianoChordRoot: 'คอร์ดที่กดอยู่บนเปียโนนี้มีโน้ตรากเป็นตัวอะไร?',
    quizPromptGuitarChord: 'ไดอะแกรมนี้คือคอร์ดอะไร?',
    quizPromptUkuleleChord: 'ไดอะแกรมนี้คือคอร์ดอูคูเลเล่อะไร?',
    quizPromptPitchCompare: 'เสียงที่ 2 สูงกว่าหรือต่ำกว่าเสียงที่ 1?',
    quizPromptPitchSameDiff: 'สองเสียงนี้เป็นเสียงเดียวกันหรือต่างกัน?',
    quizPromptChordEar: 'คอร์ดที่ได้ยินเป็นเมเจอร์หรือไมเนอร์?',
    quizPromptInterval: 'สองเสียงนี้ห่างกันเป็นขั้นคู่เสียงอะไร?',
    quizPromptRhythm: 'จังหวะที่ได้ยินตรงกับข้อไหน?',
    quizPromptProgression: 'ในโพรเกรสชัน I-V-vi-IV ตำแหน่งที่ {position} คือคอร์ดอะไร?',
    listenBtn: '🔊 ฟังเสียง',
    listenProgressionBtn: '🔊 ฟังโพรเกรสชัน I-V-vi-IV',
    listenBeatBtn: '🔊 ฟังจังหวะร็อกพื้นฐาน',
    quizPromptDrumEar: 'เสียงที่ได้ยินคือชิ้นกลองไหน?',
    quizPromptViolinString: 'เสียงที่ได้ยินคือสายเปล่าเส้นไหน?',
    correctMsg: '✅ ถูกต้อง! ปลดล็อกข้อถัดไปแล้ว',
    trackDoneMsg: '🎉 จบบทเรียนนี้แล้ว! เลือกบทเรียนถัดไปจากเมนู ☰ ด้านบนได้เลย',
    toastTrackDone: 'จบบทเรียน "{track}" แล้ว! 🎉',
    toastBadge: 'ได้รับเหรียญตรา: "{badge}"!',
    toastLevelUp: 'เลเวลอัป! เลเวล {level} — {title}'
  },
  en: {
    pageTitle: 'Learn Music', crumbResp: 'Responsibilities', crumbMusic: 'Learn Music',
    markReadBtn: '✓ Got it, continue',
    lockedMsg: 'This lesson is locked — pass the previous one first.',
    quizPromptTreble: 'Which note is this, on the treble clef?',
    quizPromptBass: 'Which note is this, on the bass clef?',
    quizPromptValue: 'Which note value is this (how many beats, in 4/4 time)?',
    quizPromptTimeSigBeats: 'How many beats are in one measure of this time signature?',
    quizPromptTimeSigUnit: 'Which note value gets one beat in this time signature?',
    quizPromptScaleDegree: 'What is note #{degree} of the C Major scale?',
    quizPromptChordQuality: 'Is this chord major or minor?',
    quizPromptChordRoot: 'What is the root note of this chord?',
    quizPromptPianoNote: 'Which note is the highlighted piano key?',
    quizPromptPianoChordQuality: 'Is this piano chord major or minor?',
    quizPromptPianoChordRoot: 'What is the root note of this piano chord?',
    quizPromptGuitarChord: 'Which chord is this diagram?',
    quizPromptUkuleleChord: 'Which ukulele chord is this diagram?',
    quizPromptPitchCompare: 'Is the 2nd note higher or lower than the 1st?',
    quizPromptPitchSameDiff: 'Are these two notes the same pitch or different?',
    quizPromptChordEar: 'Is the chord you hear major or minor?',
    quizPromptInterval: 'What interval do these two notes form?',
    quizPromptRhythm: 'Which option matches the rhythm you heard?',
    quizPromptProgression: 'In the I-V-vi-IV progression, what is chord #{position}?',
    listenBtn: '🔊 Listen',
    listenProgressionBtn: '🔊 Listen to I-V-vi-IV',
    listenBeatBtn: '🔊 Listen to the Basic Rock Beat',
    quizPromptDrumEar: 'Which drum piece is this sound?',
    quizPromptViolinString: 'Which open string is this sound?',
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
   ทฤษฎีโน้ตบนกุญแจซอล/ฟา — ระบบพิกัด: step 0 = เส้นล่างสุดของกุญแจนั้นๆ (E4 บนกุญแจซอล,
   G2 บนกุญแจฟา) แต่ละ step ขยับครึ่งช่องเส้น (เส้น↔ช่องติดกัน) — เส้นทั้ง 5 อยู่ที่ step คู่เสมอ
   (0,2,4,6,8) ไม่ว่าจะกุญแจไหน จุดนี้เองที่ทำให้ฟังก์ชันวาดบรรทัด/เส้นน้อย/ก้านโน้ตใช้ร่วมกันได้
   ทั้งสองกุญแจ ต่างกันแค่ชื่อโน้ตที่ผูกกับแต่ละ step (เริ่มตัวอักษรคนละตัว) กับกราฟิกกุญแจ
   ══════════════════════════════════════════════════════════════════ */
var CLEFS = {
  treble: { letters: ['E', 'F', 'G', 'A', 'B', 'C', 'D'], glyph: '𝄞', promptKey: 'quizPromptTreble' },
  bass: { letters: ['G', 'A', 'B', 'C', 'D', 'E', 'F'], glyph: '𝄢', promptKey: 'quizPromptBass' }
};
function letterForStep(step, clef) {
  var letters = CLEFS[clef || 'treble'].letters;
  return letters[((step % 7) + 7) % 7];
}

/* สร้าง SVG บรรทัด 5 เส้น + กุญแจ + เส้นน้อย (ถ้าจำเป็น) + หัวโน้ต/ก้านโน้ต ที่ step ที่กำหนด */
function buildStaffSvg(step, clef) {
  clef = clef || 'treble';
  var W = 220, H = 130;
  var staffLeft = 46, staffRight = 200;
  var y0 = 30; /* เส้นบนสุด (step 8) */
  function y(s) { return y0 + (8 - s) * 7; }

  var lines = [0, 2, 4, 6, 8].map(function (s) {
    return '<line x1="' + staffLeft + '" y1="' + y(s) + '" x2="' + staffRight + '" y2="' + y(s) + '" stroke="currentColor" stroke-width="1.4"/>';
  }).join('');

  var noteX = 150;
  var noteY = y(step);

  var ledger = '';
  if (step <= -2) {
    for (var s = -2; s >= step; s -= 2) {
      ledger += '<line x1="' + (noteX - 12) + '" y1="' + y(s) + '" x2="' + (noteX + 12) + '" y2="' + y(s) + '" stroke="currentColor" stroke-width="1.4"/>';
    }
  } else if (step >= 10) {
    for (var s2 = 10; s2 <= step; s2 += 2) {
      ledger += '<line x1="' + (noteX - 12) + '" y1="' + y(s2) + '" x2="' + (noteX + 12) + '" y2="' + y(s2) + '" stroke="currentColor" stroke-width="1.4"/>';
    }
  }

  var stemUp = step < 4;
  var stem = stemUp
    ? '<line x1="' + (noteX + 6.3) + '" y1="' + noteY + '" x2="' + (noteX + 6.3) + '" y2="' + (noteY - 32) + '" stroke="currentColor" stroke-width="1.6"/>'
    : '<line x1="' + (noteX - 6.3) + '" y1="' + noteY + '" x2="' + (noteX - 6.3) + '" y2="' + (noteY + 32) + '" stroke="currentColor" stroke-width="1.6"/>';

  var notehead = '<ellipse cx="' + noteX + '" cy="' + noteY + '" rx="6.8" ry="5.1" transform="rotate(-18 ' + noteX + ' ' + noteY + ')" fill="currentColor"/>';

  var clefText = '<text x="50" y="88" font-size="64" ' +
    'font-family="Segoe UI Symbol, Noto Sans Symbols 2, Apple Symbols, DejaVu Sans, sans-serif" fill="currentColor">' + CLEFS[clef].glyph + '</text>';

  return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="240" height="' + Math.round(240 * H / W) + '" ' +
    'style="max-width:100%;display:block;margin:0 auto" role="img" aria-label="staff notation">' +
    lines + clefText + ledger + stem + notehead + '</svg>';
}

/* ══════════════════════════════════════════════════════════════════
   ค่าตัวโน้ต — วาดตัวโน้ตเดี่ยวๆ ลอยไม่มีบรรทัด (ไม่เกี่ยวกับระดับเสียง สอนแค่ "รูปร่าง = จังหวะ")
   ตัวกลม: หัวโปร่งไม่มีก้าน / ตัวขาว: หัวโปร่งมีก้าน / ตัวดำ: หัวทึบมีก้าน / เขบ็ต: หัวทึบมีก้าน+หาง
   ══════════════════════════════════════════════════════════════════ */
var NOTE_VALUE_ORDER = ['whole', 'half', 'quarter', 'eighth', 'sixteenth'];
var NOTE_VALUE_LABELS = {
  whole: { th: 'ตัวกลม (4 จังหวะ)', en: 'Whole note (4 beats)' },
  half: { th: 'ตัวขาว (2 จังหวะ)', en: 'Half note (2 beats)' },
  quarter: { th: 'ตัวดำ (1 จังหวะ)', en: 'Quarter note (1 beat)' },
  eighth: { th: 'เขบ็ตหนึ่งชั้น (½ จังหวะ)', en: 'Eighth note (½ beat)' },
  sixteenth: { th: 'เขบ็ตสองชั้น (¼ จังหวะ)', en: 'Sixteenth note (¼ beat)' }
};
function buildNoteValueSvg(duration) {
  var W = 140, H = 130;
  var cx = 60, cy = 90;
  var hollow = duration === 'whole' || duration === 'half';
  var hasStem = duration !== 'whole';
  var flagCount = duration === 'eighth' ? 1 : duration === 'sixteenth' ? 2 : 0;

  var head;
  if (duration === 'whole') {
    /* ตัวกลม: วงรีโปร่งแนวนอน ไม่เอียง ไม่มีก้าน — รูปทรงต่างจากตัวอื่นชัดเจนตั้งแต่แรกเห็น */
    head = '<ellipse cx="' + cx + '" cy="' + cy + '" rx="11" ry="7.5" fill="none" stroke="currentColor" stroke-width="2.2"/>';
  } else {
    head = '<ellipse cx="' + cx + '" cy="' + cy + '" rx="7.2" ry="5.4" transform="rotate(-18 ' + cx + ' ' + cy + ')" ' +
      (hollow ? 'fill="none" stroke="currentColor" stroke-width="2.2"' : 'fill="currentColor"') + '/>';
  }

  var stem = '';
  var flags = '';
  if (hasStem) {
    var stemTopY = cy - 55;
    stem = '<line x1="' + (cx + 6.8) + '" y1="' + cy + '" x2="' + (cx + 6.8) + '" y2="' + stemTopY + '" stroke="currentColor" stroke-width="2"/>';
    for (var i = 0; i < flagCount; i++) {
      var fy = stemTopY + i * 14;
      flags += '<path d="M ' + (cx + 6.8) + ' ' + fy + ' C ' + (cx + 24) + ' ' + (fy + 4) + ', ' + (cx + 22) + ' ' + (fy + 20) + ', ' + (cx + 8) + ' ' + (fy + 24) +
        '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
    }
  }

  return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="160" height="' + Math.round(160 * H / W) + '" ' +
    'style="max-width:100%;display:block;margin:0 auto" role="img" aria-label="note value">' +
    stem + flags + head + '</svg>';
}

/* ══════════════════════════════════════════════════════════════════
   เครื่องหมายกำหนดจังหวะ — วาดบรรทัด 5 เส้น (ไม่มีกุญแจ/หัวโน้ต) + ตัวเลข 2 ตัวซ้อนกัน
   ใช้ระบบพิกัด y() เดียวกับ buildStaffSvg เพื่อวางเลขให้อยู่กึ่งกลางครึ่งบน/ล่างของบรรทัดพอดี
   ══════════════════════════════════════════════════════════════════ */
function buildTimeSigSvg(top, bottom) {
  var W = 220, H = 130;
  var staffLeft = 46, staffRight = 200;
  var y0 = 30;
  function y(s) { return y0 + (8 - s) * 7; }
  var lines = [0, 2, 4, 6, 8].map(function (s) {
    return '<line x1="' + staffLeft + '" y1="' + y(s) + '" x2="' + staffRight + '" y2="' + y(s) + '" stroke="currentColor" stroke-width="1.4"/>';
  }).join('');
  var cx = 110;
  var numFont = 'font-family="Georgia, \'Times New Roman\', serif" font-weight="800" text-anchor="middle" fill="currentColor"';
  var topText = '<text x="' + cx + '" y="' + (y(6) + 10) + '" font-size="30" ' + numFont + '>' + top + '</text>';
  var botText = '<text x="' + cx + '" y="' + (y(2) + 10) + '" font-size="30" ' + numFont + '>' + bottom + '</text>';
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="200" height="' + Math.round(200 * H / W) + '" ' +
    'style="max-width:100%;display:block;margin:0 auto" role="img" aria-label="time signature">' +
    lines + topText + botText + '</svg>';
}

/* ══════════════════════════════════════════════════════════════════
   บันไดเสียง C Major — แสดงเป็นแถวตัวอักษร (ไม่ใช่ SVG บรรทัด เพราะไม่ต้องอ้างอิงระดับเสียง
   บนบรรทัดจริง แค่ลำดับ) ตำแหน่งที่ถูกถามแสดงเป็น "?" เน้นสี
   ══════════════════════════════════════════════════════════════════ */
var SCALE_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'];
function buildScaleDisplayHtml(degree) {
  var items = SCALE_NOTES.map(function (note, i) {
    var n = i + 1;
    var isTarget = n === degree;
    var label = isTarget ? '?' : note;
    var style = 'display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:10px;' +
      'margin:3px;font-weight:800;font-size:16px;' +
      (isTarget
        ? 'background:linear-gradient(135deg,var(--mx),var(--mx2));color:#fff;box-shadow:0 4px 10px rgba(124,58,237,.3);'
        : 'background:var(--card);border:1.5px solid var(--line);color:var(--ink);');
    return '<span style="' + style + '">' + label + '</span>';
  }).join('');
  return '<div style="display:flex;flex-wrap:wrap;justify-content:center;padding:14px 0">' + items + '</div>';
}

/* ══════════════════════════════════════════════════════════════════
   คอร์ดไทรแอด — วาดโน้ต 3 ตัวซ้อนกันที่ x เดียวกันบนบรรทัด 5 เส้น (คอร์ดจริงเขียนแบบนี้)
   ใช้ y()/เส้นน้อยชุดเดียวกับ buildStaffSvg ก้านโน้ตใช้เส้นเดียวลากผ่านหัวโน้ตทั้ง 3 ตัว
   (ทิศทางก้านตัดสินจากโน้ตกลางของคอร์ด เหมือนหลักการเดิมของโน้ตเดี่ยว)
   ══════════════════════════════════════════════════════════════════ */
function buildChordStaffSvg(steps, clef) {
  clef = clef || 'treble';
  var W = 220, H = 130;
  var staffLeft = 46, staffRight = 200;
  var y0 = 30;
  function y(s) { return y0 + (8 - s) * 7; }

  var lines = [0, 2, 4, 6, 8].map(function (s) {
    return '<line x1="' + staffLeft + '" y1="' + y(s) + '" x2="' + staffRight + '" y2="' + y(s) + '" stroke="currentColor" stroke-width="1.4"/>';
  }).join('');

  var noteX = 150;
  var sorted = steps.slice().sort(function (a, b) { return a - b; });
  var minStep = sorted[0], maxStep = sorted[sorted.length - 1];

  var ledger = '';
  if (minStep <= -2) {
    for (var s = -2; s >= minStep; s -= 2) {
      ledger += '<line x1="' + (noteX - 12) + '" y1="' + y(s) + '" x2="' + (noteX + 12) + '" y2="' + y(s) + '" stroke="currentColor" stroke-width="1.4"/>';
    }
  }
  if (maxStep >= 10) {
    for (var s2 = 10; s2 <= maxStep; s2 += 2) {
      ledger += '<line x1="' + (noteX - 12) + '" y1="' + y(s2) + '" x2="' + (noteX + 12) + '" y2="' + y(s2) + '" stroke="currentColor" stroke-width="1.4"/>';
    }
  }

  var midStep = steps[1] !== undefined ? steps[1] : steps[0]; /* ตัวกลาง (3rd) ตัดสินทิศทางก้าน */
  var stemUp = midStep < 4;
  var stemX = stemUp ? noteX + 6.3 : noteX - 6.3;
  var stemY1 = stemUp ? y(maxStep) : y(minStep);
  var stemY2 = stemUp ? y(minStep) - 32 : y(maxStep) + 32;
  var stem = '<line x1="' + stemX + '" y1="' + stemY1 + '" x2="' + stemX + '" y2="' + stemY2 + '" stroke="currentColor" stroke-width="1.6"/>';

  var noteheads = steps.map(function (s) {
    return '<ellipse cx="' + noteX + '" cy="' + y(s) + '" rx="6.8" ry="5.1" transform="rotate(-18 ' + noteX + ' ' + y(s) + ')" fill="currentColor"/>';
  }).join('');

  var clefText = '<text x="50" y="88" font-size="64" ' +
    'font-family="Segoe UI Symbol, Noto Sans Symbols 2, Apple Symbols, DejaVu Sans, sans-serif" fill="currentColor">' + CLEFS[clef].glyph + '</text>';

  return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="240" height="' + Math.round(240 * H / W) + '" ' +
    'style="max-width:100%;display:block;margin:0 auto" role="img" aria-label="chord notation">' +
    lines + clefText + ledger + stem + noteheads + '</svg>';
}

/* ══════════════════════════════════════════════════════════════════
   คีย์เปียโน — วาดคีย์ขาว 14 คีย์ (2 ออกเทฟ) + คีย์ดำแทรกในตำแหน่งจริง ระบายสีเหมือนคีย์บอร์ด
   จริงเสมอ (ไม่อิงธีมมืด/สว่างของเว็บ เพราะเป็นภาพแทนวัตถุจริง เหมือนที่กรอบพรีวิว HTML ของหน้า
   coding.html ใช้พื้นขาวคงที่) ตำแหน่ง slot 0-13 นับคีย์ขาวจากซ้าย, letter = WHITE_LETTERS[slot%7]
   ตำแหน่งคอร์ด (root,3rd,5th) บนคีย์ขาวคือ slot, slot+2, slot+4 เสมอ (ข้าม 1 คีย์ขาวทุกครั้ง)
   ตรงกับไทรแอด diatonic ของ C Major ที่เรียนไปแล้วในบทคอร์ดเบื้องต้นพอดี — ใช้สูตรเดียวกันได้เลย
   ══════════════════════════════════════════════════════════════════ */
var PIANO_WHITE_KEYS = 14;
var WHITE_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
var HAS_BLACK_AFTER = { C: true, D: true, E: false, F: true, G: true, A: true, B: false };
var LETTER_TO_SLOT0 = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
function chordPianoSlots(chord) {
  var base = LETTER_TO_SLOT0[chord.root];
  return [base, base + 2, base + 4];
}
function buildPianoSvg(highlightSlots) {
  highlightSlots = highlightSlots || [];
  var whiteW = 30, whiteH = 130, blackW = 18, blackH = 82;
  var W = PIANO_WHITE_KEYS * whiteW, H = whiteH;
  var whiteRects = '';
  for (var i = 0; i < PIANO_WHITE_KEYS; i++) {
    var isHi = highlightSlots.indexOf(i) !== -1;
    whiteRects += '<rect x="' + (i * whiteW) + '" y="0" width="' + whiteW + '" height="' + whiteH + '" ' +
      'fill="' + (isHi ? 'var(--mx)' : '#FAFAFA') + '" stroke="#B8BEC9" stroke-width="1.5"/>';
  }
  var blackRects = '';
  for (var j = 0; j < PIANO_WHITE_KEYS; j++) {
    var letter = WHITE_LETTERS[j % 7];
    if (HAS_BLACK_AFTER[letter] && j < PIANO_WHITE_KEYS - 1) {
      var bx = (j + 1) * whiteW - blackW / 2;
      blackRects += '<rect x="' + bx + '" y="0" width="' + blackW + '" height="' + blackH + '" fill="#2A2E38" stroke="#111318" stroke-width="1"/>';
    }
  }
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" ' +
    'style="width:100%;max-width:420px;height:auto;display:block;margin:0 auto" role="img" aria-label="piano keyboard">' +
    whiteRects + blackRects + '</svg>';
}

/* ══════════════════════════════════════════════════════════════════
   ไดอะแกรมคอร์ดกีตาร์ — คอตาร์แนวตั้ง 6 สาย (ซ้าย=สาย 6/E ต่ำ, ขวา=สาย 1/E สูง) นัทหนาบนสุด
   ตามด้วยเฟรต 4 ช่อง pattern[i] คือ 'x' (ห้ามดีด), 0 (สายเปล่า), หรือเลขเฟรต 1-4 (ตำแหน่งกด)
   สีคงที่ไม่อิงธีมมืด/สว่างเหมือนคีย์เปียโน (ภาพแทนวัตถุจริง)
   ══════════════════════════════════════════════════════════════════ */
function buildGuitarChordSvg(pattern) {
  var W = 150, H = 150;
  var stringX0 = 20, stringSpacing = 22;
  var nutY = 34, fretSpacing = 26, numFrets = 4;
  function sx(i) { return stringX0 + i * stringSpacing; }

  var strings = '';
  for (var i = 0; i < 6; i++) {
    strings += '<line x1="' + sx(i) + '" y1="' + nutY + '" x2="' + sx(i) + '" y2="' + (nutY + numFrets * fretSpacing) + '" stroke="#3A3F4C" stroke-width="1.6"/>';
  }
  var frets = '<line x1="' + sx(0) + '" y1="' + nutY + '" x2="' + sx(5) + '" y2="' + nutY + '" stroke="#1F2430" stroke-width="5"/>';
  for (var k = 1; k <= numFrets; k++) {
    var fy = nutY + k * fretSpacing;
    frets += '<line x1="' + sx(0) + '" y1="' + fy + '" x2="' + sx(5) + '" y2="' + fy + '" stroke="#3A3F4C" stroke-width="1.6"/>';
  }

  var marks = '';
  pattern.forEach(function (v, i) {
    var x = sx(i);
    if (v === 'x') {
      marks += '<text x="' + x + '" y="18" font-size="15" font-weight="800" text-anchor="middle" fill="#B3325A">×</text>';
    } else if (v === 0) {
      marks += '<circle cx="' + x + '" cy="14" r="6" fill="none" stroke="#0F7A4E" stroke-width="2"/>';
    } else {
      var dy = nutY + (v - 0.5) * fretSpacing;
      marks += '<circle cx="' + x + '" cy="' + dy + '" r="8" fill="var(--mx)"/>';
    }
  });

  return '<svg viewBox="0 0 ' + W + ' ' + H + '" ' +
    'style="width:100%;max-width:180px;height:auto;display:block;margin:0 auto" role="img" aria-label="guitar chord diagram">' +
    strings + frets + marks + '</svg>';
}
/* ไดอะแกรมคอร์ดอูคูเลเล่ — โครงเดียวกับกีตาร์เป๊ะๆ แค่ 4 สาย (G-C-E-A) แทน 6 สาย
   คอร์ดพื้นฐาน 4 ตัว (C-G-Am-F) บังเอิญเป็นโพรเกรสชัน I-V-vi-IV เดียวกับที่เรียนไปแล้ว */
function buildUkuleleChordSvg(pattern) {
  var W = 150, H = 150;
  var stringX0 = 30, stringSpacing = 30;
  var nutY = 34, fretSpacing = 26, numFrets = 4;
  var numStrings = 4;
  function sx(i) { return stringX0 + i * stringSpacing; }

  var strings = '';
  for (var i = 0; i < numStrings; i++) {
    strings += '<line x1="' + sx(i) + '" y1="' + nutY + '" x2="' + sx(i) + '" y2="' + (nutY + numFrets * fretSpacing) + '" stroke="#3A3F4C" stroke-width="1.6"/>';
  }
  var frets = '<line x1="' + sx(0) + '" y1="' + nutY + '" x2="' + sx(numStrings - 1) + '" y2="' + nutY + '" stroke="#1F2430" stroke-width="5"/>';
  for (var k = 1; k <= numFrets; k++) {
    var fy = nutY + k * fretSpacing;
    frets += '<line x1="' + sx(0) + '" y1="' + fy + '" x2="' + sx(numStrings - 1) + '" y2="' + fy + '" stroke="#3A3F4C" stroke-width="1.6"/>';
  }

  var marks = '';
  pattern.forEach(function (v, i) {
    var x = sx(i);
    if (v === 'x') {
      marks += '<text x="' + x + '" y="18" font-size="15" font-weight="800" text-anchor="middle" fill="#B3325A">×</text>';
    } else if (v === 0) {
      marks += '<circle cx="' + x + '" cy="14" r="6" fill="none" stroke="#0F7A4E" stroke-width="2"/>';
    } else {
      var dy = nutY + (v - 0.5) * fretSpacing;
      marks += '<circle cx="' + x + '" cy="' + dy + '" r="8" fill="var(--mx)"/>';
    }
  });

  return '<svg viewBox="0 0 ' + W + ' ' + H + '" ' +
    'style="width:100%;max-width:150px;height:auto;display:block;margin:0 auto" role="img" aria-label="ukulele chord diagram">' +
    strings + frets + marks + '</svg>';
}

/* ══════════════════════════════════════════════════════════════════
   ฝึกหูดนตรี — สังเคราะห์เสียงจริงด้วย Web Audio API (oscillator คลื่นไซน์) ไม่ใช้ไฟล์เสียง
   ใดๆ เลย สร้าง AudioContext แบบ lazy (รอจนผู้ใช้กดปุ่มครั้งแรกค่อยสร้าง — เบราว์เซอร์บล็อก
   autoplay เสียงที่ไม่มาจาก user gesture อยู่แล้ว การรอให้ปุ่มเป็นตัวสร้าง context จึงถูกต้องเป๊ะ)
   ══════════════════════════════════════════════════════════════════ */
var NATURAL_SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function noteFreq(letter, octave) {
  var midi = (octave + 1) * 12 + NATURAL_SEMITONE[letter];
  return 440 * Math.pow(2, (midi - 69) / 12);
}
var audioCtx = null;
function getAudioCtx() {
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
function playTone(ctx, freq, startTime, duration) {
  var osc = ctx.createOscillator();
  var gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  /* envelope สั้นๆ กันเสียง "click" ตอนเริ่ม/จบโน้ตแบบดิบๆ */
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(0.25, startTime + 0.02);
  gain.gain.setValueAtTime(0.25, startTime + duration - 0.05);
  gain.gain.linearRampToValueAtTime(0, startTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}
/* เล่นทีละโน้ตต่อกัน (ไล่ระดับเสียง) — ใช้กับโจทย์เทียบเสียงสูง-ต่ำ/เหมือน-ต่าง */
function playSequence(freqs) {
  var ctx = getAudioCtx();
  if (!ctx) return;
  var t = ctx.currentTime + 0.05, dur = 0.55, gap = 0.15;
  freqs.forEach(function (f, i) { playTone(ctx, f, t + i * (dur + gap), dur); });
}
/* เล่นพร้อมกันทุกโน้ต (คอร์ด) — ใช้กับโจทย์แยกเมเจอร์/ไมเนอร์ด้วยหู */
function playChordTones(freqs) {
  var ctx = getAudioCtx();
  if (!ctx) return;
  var t = ctx.currentTime + 0.05, dur = 1.1;
  freqs.forEach(function (f) { playTone(ctx, f, t, dur); });
}
/* ฝึกจับจังหวะ (Rhythm Dictation) — เล่นโน้ตระดับเสียงเดียวซ้ำๆ ตามความยาวใน durations
   (หน่วยเป็น "จังหวะ" เทียบตัวโน้ตดำ=1, ตัวเขบ็ต 1 ชั้น=0.5) ให้ฟังแล้วแยกรูปแบบจังหวะ */
function playRhythm(durations) {
  var ctx = getAudioCtx();
  if (!ctx) return;
  var beatSec = 0.42, t = ctx.currentTime + 0.05;
  durations.forEach(function (d) {
    var dur = d * beatSec;
    playTone(ctx, 880, t, dur * 0.55);
    t += dur;
  });
}
function buildEarPlayerHtml() {
  return '<div style="text-align:center;padding:24px 0">' +
    '<button type="button" id="earPlayBtn" class="btn primary" style="font-size:16px;padding:16px 32px">' + t('listenBtn') + '</button>' +
    '</div>';
}

/* ══════════════════════════════════════════════════════════════════
   สังเคราะห์เสียงกลอง (ไม่ใช้ไฟล์เสียง เหมือนโน้ตดนตรีอื่นๆ ในหน้านี้) — Kick ใช้ sine
   กวาดความถี่ลง (pitch envelope) แบบกลองเบสดรัมจริง, Snare/Hi-Hat ใช้ white noise buffer
   ผ่านฟิลเตอร์ความถี่คนละแบบ (Snare ผสมโทนกลาง 180Hz, Hi-Hat highpass สูงมาก สั้นกระชับ)
   ══════════════════════════════════════════════════════════════════ */
var drumNoiseBuffer = null;
function getDrumNoiseBuffer(ctx) {
  if (drumNoiseBuffer) return drumNoiseBuffer;
  var size = ctx.sampleRate * 0.5;
  drumNoiseBuffer = ctx.createBuffer(1, size, ctx.sampleRate);
  var data = drumNoiseBuffer.getChannelData(0);
  for (var i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
  return drumNoiseBuffer;
}
function playKickAt(ctx, startTime) {
  var osc = ctx.createOscillator();
  var gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, startTime);
  osc.frequency.exponentialRampToValueAtTime(45, startTime + 0.15);
  gain.gain.setValueAtTime(0.9, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(startTime); osc.stop(startTime + 0.32);
}
function playSnareAt(ctx, startTime) {
  var noise = ctx.createBufferSource();
  noise.buffer = getDrumNoiseBuffer(ctx);
  var noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'highpass';
  noiseFilter.frequency.value = 1000;
  var noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.6, startTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);
  noise.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(ctx.destination);
  noise.start(startTime); noise.stop(startTime + 0.2);

  var osc = ctx.createOscillator();
  var oscGain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = 180;
  oscGain.gain.setValueAtTime(0.35, startTime);
  oscGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.12);
  osc.connect(oscGain); oscGain.connect(ctx.destination);
  osc.start(startTime); osc.stop(startTime + 0.14);
}
function playHiHatAt(ctx, startTime) {
  var noise = ctx.createBufferSource();
  noise.buffer = getDrumNoiseBuffer(ctx);
  var filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 7000;
  var gain = ctx.createGain();
  gain.gain.setValueAtTime(0.4, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.06);
  noise.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
  noise.start(startTime); noise.stop(startTime + 0.08);
}
function playDrumHit(type) {
  var ctx = getAudioCtx();
  if (!ctx) return;
  var t = ctx.currentTime + 0.05;
  if (type === 'kick') playKickAt(ctx, t);
  else if (type === 'snare') playSnareAt(ctx, t);
  else playHiHatAt(ctx, t);
}
/* จังหวะร็อกพื้นฐาน (Basic Rock Beat): Kick จังหวะ 1&3, Snare จังหวะ 2&4, Hi-Hat ทุกจังหวะ */
function playRockBeat() {
  var ctx = getAudioCtx();
  if (!ctx) return;
  var t = ctx.currentTime + 0.05, beatSec = 0.42;
  var beats = ['kick', 'snare', 'kick', 'snare'];
  beats.forEach(function (b, i) {
    var bt = t + i * beatSec;
    if (b === 'kick') playKickAt(ctx, bt); else playSnareAt(ctx, bt);
    playHiHatAt(ctx, bt);
  });
}
function buildDrumBeatListenHtml() {
  return '<div style="text-align:center;padding:14px 0 4px">' +
    '<button type="button" id="drumBeatPlayBtn" class="btn primary">' + t('listenBeatBtn') + '</button>' +
    '</div>';
}

/* ══════════════════════════════════════════════════════════════════
   โพรเกรสชัน I-V-vi-IV (C-G-Am-F) — เล่นคอร์ดเรียงต่อกันทีละคอร์ด (ต่างจาก playChordTones
   ที่เล่นคอร์ดเดียว) ใช้ CHORD_NOTE_OCTAVES ร่วมกับบทฝึกหูดนตรี (นิยามไว้ด้านล่างในหมวด
   "เนื้อหาบทเรียน" — ฟังก์ชันในบล็อกนี้อ้างอิงถึงแค่ภายใน closure จึงเรียกได้ปกติตอนใช้งานจริง
   แม้ตัวแปรจะถูกประกาศทีหลังในไฟล์ก็ตาม)
   ══════════════════════════════════════════════════════════════════ */
var PROGRESSION_CHORD_INDEXES = [0, 4, 5, 3]; /* I, V, vi, IV ตามลำดับ index ใน CHORDS */
var PROGRESSION_ROMAN = ['I', 'V', 'vi', 'IV'];
var PROGRESSION_QUIZ_OPTIONS = ['C', 'G', 'Am', 'F'];
var PROGRESSION_LABELS = { C: { th: 'C', en: 'C' }, G: { th: 'G', en: 'G' }, Am: { th: 'Am', en: 'Am' }, F: { th: 'F', en: 'F' } };
function progressionFreqs() {
  return PROGRESSION_CHORD_INDEXES.map(function (idx) {
    return CHORD_NOTE_OCTAVES[idx].map(function (n) { return noteFreq(n[0], n[1]); });
  });
}
function playProgression(chordFreqsList) {
  var ctx = getAudioCtx();
  if (!ctx) return;
  var t0 = ctx.currentTime + 0.05, dur = 0.7, gap = 0.15;
  chordFreqsList.forEach(function (freqs, i) {
    var startT = t0 + i * (dur + gap);
    freqs.forEach(function (f) { playTone(ctx, f, startT, dur); });
  });
}
function buildProgressionListenHtml() {
  return '<div style="text-align:center;padding:14px 0 4px">' +
    '<button type="button" id="progPlayBtn" class="btn primary">' + t('listenProgressionBtn') + '</button>' +
    '</div>';
}
function buildProgressionDisplayHtml(position) {
  var items = PROGRESSION_ROMAN.map(function (roman, i) {
    var n = i + 1;
    var isTarget = n === position;
    var label = isTarget ? '?' : roman;
    var style = 'display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:10px;' +
      'margin:3px;font-weight:800;font-size:16px;' +
      (isTarget
        ? 'background:linear-gradient(135deg,var(--mx),var(--mx2));color:#fff;box-shadow:0 4px 10px rgba(124,58,237,.3);'
        : 'background:var(--card);border:1.5px solid var(--line);color:var(--ink);');
    return '<span style="' + style + '">' + label + '</span>';
  }).join('');
  return '<div style="display:flex;flex-wrap:wrap;justify-content:center;padding:10px 0">' + items + '</div>' +
    buildProgressionListenHtml();
}
function quizProgressionItem(position) {
  return { kind: 'quiz', qType: 'progression-position', position: position, answer: PROGRESSION_QUIZ_OPTIONS[position - 1] };
}
/* คำถามเลือกตอบทั่วไป — ต่างจากคำถามชนิดอื่นตรงที่ตัวเลือก/คำถามผูกอยู่กับ item เอง ไม่ใช่ชุด
   คงที่ทั้งแอป ใช้เมื่อคำตอบมีตัวเลือกเฉพาะเจาะจง (เช่น มีเครื่องหมาย # หรือ ♭ ที่ระบบตัวอักษร
   A-G เดิมไม่รองรับ) options: [{key, label:{th,en}}], answer: key ของตัวเลือกที่ถูก */
function mcqItem(promptTh, promptEn, options, answer) {
  return { kind: 'quiz', qType: 'mcq', prompt: { th: promptTh, en: promptEn }, options: options, answer: answer };
}
function mcqOpt(key, th, en) { return { key: key, label: { th: th, en: en } }; }

/* ══════════════════════════════════════════════════════════════════
   เนื้อหาบทเรียน
   ══════════════════════════════════════════════════════════════════ */
function readingItem(headingTh, headingEn, paragraphsTh, paragraphsEn) {
  return { kind: 'reading', heading: { th: headingTh, en: headingEn }, body: { th: paragraphsTh, en: paragraphsEn } };
}
function quizNoteItem(step, clef) {
  clef = clef || 'treble';
  return { kind: 'quiz', qType: 'note-name', clef: clef, step: step, answer: letterForStep(step, clef) };
}
function quizValueItem(duration) {
  return { kind: 'quiz', qType: 'note-value', duration: duration, answer: duration };
}
function quizTimeSigBeatsItem(top, bottom) {
  return { kind: 'quiz', qType: 'time-sig-beats', top: top, bottom: bottom, answer: top };
}
var UNIT_FOR_BOTTOM = { 2: 'half', 4: 'quarter', 8: 'eighth' };
function quizTimeSigUnitItem(top, bottom) {
  return { kind: 'quiz', qType: 'time-sig-unit', top: top, bottom: bottom, answer: UNIT_FOR_BOTTOM[bottom] };
}
function quizScaleItem(degree) {
  return { kind: 'quiz', qType: 'scale-degree', degree: degree, answer: SCALE_NOTES[degree - 1] };
}
/* คอร์ดไทรแอด diatonic 6 ตัวแรกของ C Major (I ii iii IV V vi) — ข้าม vii° diminished
   ไว้ก่อน (บทเรียนคุยถึงแค่เนื้อหา ไม่ควิซ เพราะจะเพิ่มตัวเลือกที่ 3 นอกเหนือ major/minor) */
var CHORDS = [
  { roman: 'I', root: 'C', quality: 'major', steps: [-2, 0, 2] },
  { roman: 'ii', root: 'D', quality: 'minor', steps: [-1, 1, 3] },
  { roman: 'iii', root: 'E', quality: 'minor', steps: [0, 2, 4] },
  { roman: 'IV', root: 'F', quality: 'major', steps: [1, 3, 5] },
  { roman: 'V', root: 'G', quality: 'major', steps: [2, 4, 6] },
  { roman: 'vi', root: 'A', quality: 'minor', steps: [3, 5, 7] }
];
function quizChordQualityItem(chord) {
  return { kind: 'quiz', qType: 'chord-quality', steps: chord.steps, answer: chord.quality };
}
function quizChordRootItem(chord) {
  return { kind: 'quiz', qType: 'chord-root', steps: chord.steps, answer: chord.root };
}
function quizPianoNoteItem(slot) {
  return { kind: 'quiz', qType: 'piano-note', slot: slot, answer: WHITE_LETTERS[((slot % 7) + 7) % 7] };
}
function quizPianoChordQualityItem(chord) {
  return { kind: 'quiz', qType: 'piano-chord-quality', slots: chordPianoSlots(chord), answer: chord.quality };
}
function quizPianoChordRootItem(chord) {
  return { kind: 'quiz', qType: 'piano-chord-root', slots: chordPianoSlots(chord), answer: chord.root };
}
/* คอร์ดเปิด (open chord) มาตรฐาน 8 คอร์ดที่มือใหม่กีตาร์ทุกคนเรียนก่อน — pattern เรียงจาก
   สาย 6 (E ต่ำ) ไปสาย 1 (E สูง): 'x' = ห้ามดีด, 0 = สายเปล่า, ตัวเลข = เฟรตที่ต้องกด */
var GUITAR_CHORDS = [
  { name: 'C', label: { th: 'C เมเจอร์', en: 'C Major' }, pattern: ['x', 3, 2, 0, 1, 0] },
  { name: 'G', label: { th: 'G เมเจอร์', en: 'G Major' }, pattern: [3, 2, 0, 0, 0, 3] },
  { name: 'D', label: { th: 'D เมเจอร์', en: 'D Major' }, pattern: ['x', 'x', 0, 2, 3, 2] },
  { name: 'A', label: { th: 'A เมเจอร์', en: 'A Major' }, pattern: ['x', 0, 2, 2, 2, 0] },
  { name: 'E', label: { th: 'E เมเจอร์', en: 'E Major' }, pattern: [0, 2, 2, 1, 0, 0] },
  { name: 'Em', label: { th: 'E ไมเนอร์ (Em)', en: 'E minor (Em)' }, pattern: [0, 2, 2, 0, 0, 0] },
  { name: 'Am', label: { th: 'A ไมเนอร์ (Am)', en: 'A minor (Am)' }, pattern: ['x', 0, 2, 2, 1, 0] },
  { name: 'Dm', label: { th: 'D ไมเนอร์ (Dm)', en: 'D minor (Dm)' }, pattern: ['x', 'x', 0, 2, 3, 1] }
];
var GUITAR_CHORD_LABELS = {};
GUITAR_CHORDS.forEach(function (c) { GUITAR_CHORD_LABELS[c.name] = c.label; });
var GUITAR_CHORD_NAMES = GUITAR_CHORDS.map(function (c) { return c.name; });
function quizGuitarChordItem(chord) {
  return { kind: 'quiz', qType: 'guitar-chord', pattern: chord.pattern, answer: chord.name };
}
/* คอร์ดเปิดพื้นฐาน 4 คอร์ดของอูคูเลเล่ — pattern เรียงจากสาย G (ซ้ายสุด) ไปสาย A (ขวาสุด)
   บังเอิญเป็นคอร์ดชุดเดียวกับโพรเกรสชัน I-V-vi-IV (C-G-Am-F) ที่เรียนไปแล้วในบทเปียโน/กีตาร์ */
var UKULELE_CHORDS = [
  { name: 'C', label: { th: 'C เมเจอร์', en: 'C Major' }, pattern: [0, 0, 0, 3] },
  { name: 'G', label: { th: 'G เมเจอร์', en: 'G Major' }, pattern: [0, 2, 3, 2] },
  { name: 'Am', label: { th: 'A ไมเนอร์ (Am)', en: 'A minor (Am)' }, pattern: [2, 0, 0, 0] },
  { name: 'F', label: { th: 'F เมเจอร์', en: 'F Major' }, pattern: [2, 0, 1, 0] }
];
var UKULELE_CHORD_LABELS = {};
UKULELE_CHORDS.forEach(function (c) { UKULELE_CHORD_LABELS[c.name] = c.label; });
var UKULELE_CHORD_NAMES = UKULELE_CHORDS.map(function (c) { return c.name; });
function quizUkuleleChordItem(chord) {
  return { kind: 'quiz', qType: 'ukulele-chord', pattern: chord.pattern, answer: chord.name };
}
function quizPitchCompareItem(note1, oct1, note2, oct2) {
  var f1 = noteFreq(note1, oct1), f2 = noteFreq(note2, oct2);
  return { kind: 'quiz', qType: 'pitch-compare', freqs: [f1, f2], answer: f2 > f1 ? 'higher' : 'lower' };
}
function quizPitchSameDiffItem(note1, oct1, note2, oct2) {
  var f1 = noteFreq(note1, oct1), f2 = noteFreq(note2, oct2);
  var same = note1 === note2 && oct1 === oct2;
  return { kind: 'quiz', qType: 'pitch-same-diff', freqs: [f1, f2], answer: same ? 'same' : 'different' };
}
/* ขั้นคู่เสียง (Interval) — เริ่มจาก C4 เสมอ ให้เป็นโน้ตธรรมชาติล้วน (ไม่ต้องมีชาร์ป/แฟลต)
   เพื่อไม่ต้องพึ่งความรู้ "ขยายทฤษฎีเกิน C Major" ก่อนก็เรียนได้ */
function quizIntervalItem(letter, octave, key) {
  var f1 = noteFreq('C', 4), f2 = noteFreq(letter, octave);
  return { kind: 'quiz', qType: 'interval-ear', freqs: [f1, f2], answer: key };
}
/* จังหวะ (Rhythm Dictation) — แต่ละแพทเทิร์นรวมความยาว 4 จังหวะเท่ากันหมด ต่างกันแค่การแบ่งย่อย
   ให้แยกด้วยหูว่าเป็นรูปแบบไหน (durations: หน่วยจังหวะ ตัวดำ=1, เขบ็ต1ชั้น=0.5) */
var RHYTHM_PATTERNS = {
  steady: { durations: [1, 1, 1, 1], label: { th: 'เรียบเสมอ (♩ ♩ ♩ ♩)', en: 'Even (♩ ♩ ♩ ♩)' } },
  shortShortLong: { durations: [0.5, 0.5, 1, 1, 1], label: { th: 'สั้น-สั้น-ยาว-ยาว-ยาว (♪ ♪ ♩ ♩ ♩)', en: 'Short-short-long-long-long (♪ ♪ ♩ ♩ ♩)' } },
  longShortShort: { durations: [1, 0.5, 0.5, 1, 1], label: { th: 'ยาว-สั้น-สั้น-ยาว-ยาว (♩ ♪ ♪ ♩ ♩)', en: 'Long-short-short-long-long (♩ ♪ ♪ ♩ ♩)' } },
  fourEighths: { durations: [0.5, 0.5, 0.5, 0.5, 1, 1], label: { th: 'สั้นสี่ตัว-ยาวสองตัว (♪ ♪ ♪ ♪ ♩ ♩)', en: 'Four short-two long (♪ ♪ ♪ ♪ ♩ ♩)' } }
};
var RHYTHM_PATTERN_KEYS = ['steady', 'shortShortLong', 'longShortShort', 'fourEighths'];
var RHYTHM_PATTERN_LABELS = {};
RHYTHM_PATTERN_KEYS.forEach(function (k) { RHYTHM_PATTERN_LABELS[k] = RHYTHM_PATTERNS[k].label; });
function quizRhythmItem(key) {
  return { kind: 'quiz', qType: 'rhythm-dictation', durations: RHYTHM_PATTERNS[key].durations, answer: key };
}
/* ตำแหน่งโน้ต+ออกเทฟของแต่ละคอร์ดใน CHORDS (index เดียวกัน) — ใช้ค่าเดิมจากบทคอร์ดเบื้องต้น/
   หัดเล่นเปียโน ให้เสียงที่ได้ยินตรงกับโน้ตที่เคยเห็นบนบรรทัด/คีย์เปียโนพอดี ไม่ต้องคิดใหม่ */
var CHORD_NOTE_OCTAVES = {
  0: [['C', 4], ['E', 4], ['G', 4]],
  1: [['D', 4], ['F', 4], ['A', 4]],
  3: [['F', 4], ['A', 4], ['C', 5]],
  4: [['G', 4], ['B', 4], ['D', 5]],
  5: [['A', 4], ['C', 5], ['E', 5]]
};
function quizChordEarItem(chordIdx) {
  var freqs = CHORD_NOTE_OCTAVES[chordIdx].map(function (n) { return noteFreq(n[0], n[1]); });
  return { kind: 'quiz', qType: 'chord-quality-ear', freqs: freqs, answer: CHORDS[chordIdx].quality };
}
var DRUM_HIT_OPTIONS = ['kick', 'snare', 'hihat'];
var DRUM_HIT_LABELS = {
  kick: { th: 'กระเดื่อง (Kick)', en: 'Kick' },
  snare: { th: 'สแนร์ (Snare)', en: 'Snare' },
  hihat: { th: 'ไฮแฮต (Hi-Hat)', en: 'Hi-Hat' }
};
function quizDrumEarItem(type) {
  return { kind: 'quiz', qType: 'drum-ear', drumType: type, answer: type };
}
/* สายเปล่าไวโอลิน 4 สาย เรียงเป็นคู่ 5 (perfect 5th) ทุกคู่: G3-D4-A4-E5 */
var VIOLIN_STRING_OPTIONS = ['G', 'D', 'A', 'E'];
var VIOLIN_STRING_LABELS = {
  G: { th: 'สาย G (ต่ำสุด)', en: 'G string (lowest)' },
  D: { th: 'สาย D', en: 'D string' },
  A: { th: 'สาย A', en: 'A string' },
  E: { th: 'สาย E (สูงสุด)', en: 'E string (highest)' }
};
var VIOLIN_STRING_OCTAVES = { G: 3, D: 4, A: 4, E: 5 };
function quizViolinStringItem(letter) {
  return { kind: 'quiz', qType: 'violin-string-ear', freq: noteFreq(letter, VIOLIN_STRING_OCTAVES[letter]), answer: letter };
}

var TRACKS = [
  {
    id: 'staff-clef',
    label: { th: 'บรรทัด 5 เส้น และกุญแจซอล', en: 'The Staff & Treble Clef' },
    group: { th: 'ทฤษฎีดนตรีพื้นฐาน', en: 'Music Theory Basics' },
    items: [
      readingItem('บรรทัด 5 เส้น (The Staff)', 'The Staff',
        [
          "โน้ตดนตรีสากลเขียนอยู่บน 'บรรทัด 5 เส้น' (staff หรือ stave) — เส้นขนานกัน 5 เส้น ทำให้เกิดช่องว่าง 4 ช่องระหว่างเส้น",
          'นับเส้นและช่องจากล่างขึ้นบนเสมอ: เส้นที่ 1 อยู่ล่างสุด เส้นที่ 5 อยู่บนสุด ยิ่งโน้ตอยู่สูงบนบรรทัด เสียงก็ยิ่งสูงตาม',
          "โน้ตแต่ละตัวจะถูกวาง 'บนเส้น' หรือ 'ในช่องว่าง' ระหว่างสองเส้น — ตำแหน่งนี้เองที่บอกว่าโน้ตนั้นคือเสียงอะไร"
        ],
        [
          "Music notation is written on a 'staff' (or stave) — five parallel lines that create four spaces between them.",
          'Always count lines and spaces from bottom to top: line 1 is the lowest, line 5 is the highest. The higher a note sits on the staff, the higher it sounds.',
          "Each note is placed either 'on a line' or 'in a space' — this exact position tells you which pitch the note represents."
        ]),
      readingItem('กุญแจซอล (Treble Clef)', 'The Treble Clef',
        [
          'กุญแจ (clef) คือสัญลักษณ์ที่วางไว้ต้นบรรทัดเสมอ ทำหน้าที่กำหนดว่าแต่ละเส้น/ช่องแทนโน้ตอะไร',
          "กุญแจซอล (Treble Clef หรือ G Clef) ใช้เขียนโน้ตเสียงสูง เช่น มือขวาเปียโน ไวโอลิน ขลุ่ย — จุดม้วนตัวก้นหอยของสัญลักษณ์จะวนรอบเส้นที่ 2 นับจากล่าง กำหนดให้เส้นนั้นคือโน้ต G4 (จึงเรียกอีกชื่อว่า 'กุญแจ G')",
          "จำชื่อเส้นทั้ง 5 (ล่างขึ้นบน: E-G-B-D-F) ด้วยประโยค 'Every Good Boy Does Fine' และจำชื่อช่องทั้ง 4 (ล่างขึ้นบน: F-A-C-E) ด้วยคำว่า 'FACE' — สองอย่างนี้คือกุญแจสำคัญที่จะใช้อ่านโน้ตในบทถัดไป"
        ],
        [
          'A clef is a symbol placed at the very start of the staff. It defines which pitch each line and space represents.',
          "The Treble Clef (or G Clef) is used for higher-pitched notes — e.g. right hand on piano, violin, flute. The curl of the symbol wraps around the 2nd line from the bottom, marking that line as G4 (hence 'G Clef').",
          "Remember the five lines (bottom to top: E-G-B-D-F) with 'Every Good Boy Does Fine', and the four spaces (bottom to top: F-A-C-E) simply spell 'FACE'. These are the key to reading notes in the next lesson."
        ]),
      readingItem('เส้นน้อย และโน้ตตัวกลาง C', 'Ledger Lines & Middle C',
        [
          "เมื่อโน้ตมีเสียงสูงหรือต่ำเกินกว่าบรรทัด 5 เส้นจะรองรับได้ จะมีการตีเส้นสั้นๆ เพิ่มขึ้นทีละเส้น เรียกว่า 'เส้นน้อย' (ledger line) เพื่อขยายขอบเขตของบรรทัดออกไป",
          'โน้ตตัวกลาง C (Middle C หรือ C4) คือหนึ่งในโน้ตที่สำคัญที่สุดในดนตรี — บนกุญแจซอล มันอยู่บนเส้นน้อยเส้นแรกใต้บรรทัดพอดี',
          'โน้ตตัวกลาง C เป็นจุดอ้างอิงกลางที่เชื่อมกุญแจซอล (โน้ตสูง) กับกุญแจฟา (โน้ตต่ำ) เข้าด้วยกัน — บทถัดไปเราจะฝึกอ่านโน้ตทุกตำแหน่งบนกุญแจซอล ตั้งแต่ C4 นี้ไปจนถึง A5'
        ],
        [
          "When a note is too high or too low to fit on the five-line staff, extra short lines are added one at a time — called 'ledger lines' — to extend the staff's range.",
          'Middle C (C4) is one of the most important notes in music. On the treble clef, it sits exactly on the first ledger line below the staff.',
          "Middle C is the central reference point linking the treble clef (higher notes) with the bass clef (lower notes). In the next lesson we'll practice reading every position on the treble staff, from this C4 up to A5."
        ])
    ]
  },
  {
    id: 'note-reading-treble',
    label: { th: 'อ่านโน้ตบนกุญแจซอล', en: 'Reading Treble Clef Notes' },
    group: { th: 'ทฤษฎีดนตรีพื้นฐาน', en: 'Music Theory Basics' },
    items: [
      readingItem('วิธีอ่านโน้ตบนกุญแจซอล', 'How to Read Treble Clef Notes',
        [
          'ทบทวน: เส้น 5 เส้นของกุญแจซอลคือ E-G-B-D-F (ล่างขึ้นบน) และช่อง 4 ช่องคือ F-A-C-E (ล่างขึ้นบน)',
          'ต่อจากนี้จะมีโน้ตปรากฏบนบรรทัดทีละตัว ให้กดปุ่มตัวอักษร (A-G) ที่ตรงกับชื่อโน้ตนั้น ถ้าตอบถูกจะปลดล็อกข้อถัดไปทันที ถ้าตอบผิดลองใหม่ได้เรื่อยๆ',
          'เคล็ดลับ: นับจากตำแหน่งที่จำได้ (เช่น เส้นกลาง B4 หรือคำว่า FACE) แล้วนับขึ้น/ลงทีละขั้นไปยังโน้ตที่ถาม จะเร็วกว่าท่องจำทุกตำแหน่งแยกกัน'
        ],
        [
          "Recap: the treble clef's 5 lines are E-G-B-D-F (bottom to top), and its 4 spaces are F-A-C-E (bottom to top).",
          "From here, a note will appear on the staff one at a time. Click the letter button (A-G) that matches its name. Get it right to unlock the next one instantly — get it wrong and just try again.",
          'Tip: count up or down from a position you already know (like the middle line B4, or FACE) to reach the note being asked — faster than memorizing every position separately.'
        ]),
      quizNoteItem(0),  /* E4 — เส้นล่างสุด */
      quizNoteItem(4),  /* B4 — เส้นกลาง */
      quizNoteItem(8),  /* F5 — เส้นบนสุด */
      quizNoteItem(2),  /* G4 */
      quizNoteItem(6),  /* D5 */
      quizNoteItem(1),  /* F4 */
      quizNoteItem(3),  /* A4 */
      quizNoteItem(5),  /* C5 */
      quizNoteItem(7),  /* E5 */
      quizNoteItem(9),  /* G5 */
      quizNoteItem(-1), /* D4 */
      quizNoteItem(-2), /* C4 — โน้ตตัวกลาง C */
      quizNoteItem(10)  /* A5 */
    ]
  },
  {
    id: 'bass-clef',
    label: { th: 'อ่านโน้ตบนกุญแจฟา', en: 'Reading Bass Clef Notes' },
    group: { th: 'ทฤษฎีดนตรีพื้นฐาน', en: 'Music Theory Basics' },
    items: [
      readingItem('กุญแจฟา (Bass Clef)', 'The Bass Clef',
        [
          'กุญแจฟา (Bass Clef หรือ F Clef) ใช้เขียนโน้ตเสียงต่ำ เช่น มือซ้ายเปียโน เชลโล กีตาร์เบส เสียงร้องทุ้ม — จุดสองจุดของสัญลักษณ์คร่อมเส้นที่ 4 นับจากล่าง กำหนดให้เส้นนั้นคือโน้ต F3 (จึงเรียกอีกชื่อว่า \'กุญแจ F\')',
          "จำชื่อเส้นทั้ง 5 (ล่างขึ้นบน: G-B-D-F-A) ด้วยประโยค 'Good Boys Do Fine Always' และจำชื่อช่องทั้ง 4 (ล่างขึ้นบน: A-C-E-G) ด้วยประโยค 'All Cows Eat Grass'",
          'กุญแจฟาอยู่ต่ำกว่ากุญแจซอลพอดี โน้ตตัวกลาง C (C4) บนกุญแจฟาจึงอยู่บนเส้นน้อยเส้นแรก "เหนือ" บรรทัด (สลับด้านกับกุญแจซอลที่ C4 อยู่ใต้บรรทัด) — วิธีตอบเหมือนเดิมทุกอย่าง แค่เปลี่ยนกุญแจ'
        ],
        [
          "The Bass Clef (or F Clef) is used for lower-pitched notes — e.g. left hand on piano, cello, bass guitar, lower voices. The two dots of the symbol straddle the 4th line from the bottom, marking that line as F3 (hence 'F Clef').",
          "Remember the five lines (bottom to top: G-B-D-F-A) with 'Good Boys Do Fine Always', and the four spaces (bottom to top: A-C-E-G) with 'All Cows Eat Grass'.",
          "The bass clef sits just below the treble clef — Middle C (C4) on the bass clef sits on the first ledger line ABOVE the staff (the opposite side from the treble clef, where C4 sits below). Answering works exactly the same way, just a different clef."
        ]),
      quizNoteItem(0, 'bass'),  /* G2 — เส้นล่างสุด */
      quizNoteItem(4, 'bass'),  /* D3 — เส้นกลาง */
      quizNoteItem(8, 'bass'),  /* A3 — เส้นบนสุด */
      quizNoteItem(2, 'bass'),  /* B2 */
      quizNoteItem(6, 'bass'),  /* F3 */
      quizNoteItem(1, 'bass'),  /* A2 */
      quizNoteItem(3, 'bass'),  /* C3 */
      quizNoteItem(5, 'bass'),  /* E3 */
      quizNoteItem(7, 'bass'),  /* G3 */
      quizNoteItem(10, 'bass')  /* C4 — โน้ตตัวกลาง C บนกุญแจฟา (เส้นน้อยเหนือบรรทัด) */
    ]
  },
  {
    id: 'note-values',
    label: { th: 'ค่าตัวโน้ตและจังหวะ', en: 'Note Values & Rhythm' },
    group: { th: 'ทฤษฎีดนตรีพื้นฐาน', en: 'Music Theory Basics' },
    items: [
      readingItem('รู้จักตัวโน้ตแต่ละแบบ', 'Meet the Note Values',
        [
          'นอกจาก "ตำแหน่ง" บนบรรทัดจะบอกระดับเสียง รูปร่างของตัวโน้ตยังบอก "ความยาว" ของเสียงนั้นด้วย (กี่จังหวะ) — สมมติว่ากำลังเล่นในจังหวะ 4/4 (มี 4 จังหวะต่อห้อง)',
          'ตัวกลม (Whole note) = 4 จังหวะ — วงรีโปร่ง ไม่มีก้าน. ตัวขาว (Half note) = 2 จังหวะ — วงรีโปร่ง มีก้าน',
          'ตัวดำ (Quarter note) = 1 จังหวะ — วงรีทึบ มีก้าน. เขบ็ตหนึ่งชั้น (Eighth note) = ครึ่งจังหวะ — วงรีทึบ มีก้าน มีหาง 1 เส้น',
          'เขบ็ตสองชั้น (Sixteenth note) = หนึ่งในสี่จังหวะ — วงรีทึบ มีก้าน มีหาง 2 เส้น — ยิ่งมีหางเยอะ ยิ่งเล่นเร็ว/สั้นลง'
        ],
        [
          'Besides pitch (which the position on the staff tells you), the shape of a note also tells you its duration (how many beats) — assuming we\'re in 4/4 time (4 beats per bar).',
          'Whole note = 4 beats — hollow oval, no stem. Half note = 2 beats — hollow oval, with a stem.',
          'Quarter note = 1 beat — filled oval, with a stem. Eighth note = ½ beat — filled oval, stem, one flag.',
          'Sixteenth note = ¼ beat — filled oval, stem, two flags — more flags means faster/shorter.'
        ]),
      readingItem('ความสัมพันธ์ของค่าตัวโน้ต', 'How Note Values Relate',
        [
          'ค่าตัวโน้ตแต่ละระดับ "หารครึ่ง" ตัวก่อนหน้าเสมอ: 1 ตัวกลม = 2 ตัวขาว = 4 ตัวดำ = 8 เขบ็ตหนึ่งชั้น = 16 เขบ็ตสองชั้น',
          'ลองนึกภาพแบ่งพิซซ่า 1 ถาด (ตัวกลม = 4 จังหวะ) ออกเป็น 2 ชิ้นเท่ากัน (ตัวขาว = ชิ้นละ 2 จังหวะ) แบ่งต่ออีกทีเป็น 4 ชิ้น (ตัวดำ = ชิ้นละ 1 จังหวะ) — หารครึ่งไปเรื่อยๆ',
          'บทถัดไปจะมีโน้ตแต่ละแบบให้ดู แล้วเลือกว่าคือตัวอะไร — สังเกตที่หัวโน้ต (โปร่ง/ทึบ) และหาง (มี/ไม่มี, กี่เส้น) เป็นหลัก'
        ],
        [
          'Each note value is always half of the one before it: 1 whole note = 2 half notes = 4 quarter notes = 8 eighth notes = 16 sixteenth notes.',
          'Picture splitting one pizza (whole note = 4 beats) into 2 equal slices (half notes = 2 beats each), then into 4 slices (quarter notes = 1 beat each) — halving each time.',
          "The next lesson will show you each note shape and ask you to identify it — look mainly at the notehead (hollow/filled) and the flags (none, one, or two)."
        ]),
      quizValueItem('quarter'),
      quizValueItem('whole'),
      quizValueItem('half'),
      quizValueItem('eighth'),
      quizValueItem('sixteenth')
    ]
  },
  {
    id: 'time-signatures',
    label: { th: 'เครื่องหมายกำหนดจังหวะ', en: 'Time Signatures' },
    group: { th: 'ทฤษฎีดนตรีพื้นฐาน', en: 'Music Theory Basics' },
    items: [
      readingItem('เครื่องหมายกำหนดจังหวะคืออะไร', 'What Is a Time Signature',
        [
          'เครื่องหมายกำหนดจังหวะ (Time Signature) คือตัวเลข 2 ตัวเขียนซ้อนกันไว้ต้นเพลง (หลังกุญแจ) บอกว่าในแต่ละห้องเพลง (measure/bar) มีกี่จังหวะ และโน้ตตัวไหนนับเป็น 1 จังหวะ',
          'ตัวเลขบน บอกว่า 1 ห้องมีกี่จังหวะ เช่น 3/4 หมายถึง 1 ห้องมี 3 จังหวะ',
          'ตัวเลขล่าง บอกว่าโน้ตตัวไหนได้ 1 จังหวะ โดยนับจากค่าตัวโน้ตที่เรียนไปก่อนหน้า: เลข 4 = โน้ตตัวดำได้ 1 จังหวะ, เลข 8 = โน้ตเขบ็ตหนึ่งชั้นได้ 1 จังหวะ, เลข 2 = โน้ตตัวขาวได้ 1 จังหวะ'
        ],
        [
          'A Time Signature is two numbers stacked at the start of a piece (right after the clef). It tells you how many beats are in each measure (bar), and which note value counts as one beat.',
          'The top number tells you how many beats are in one measure — e.g. 3/4 means each measure has 3 beats.',
          'The bottom number tells you which note gets one beat, based on the note values you already learned: 4 = quarter note gets 1 beat, 8 = eighth note gets 1 beat, 2 = half note gets 1 beat.'
        ]),
      readingItem('จังหวะที่พบบ่อย', 'Common Time Signatures',
        [
          '4/4 (Common Time) — 4 จังหวะต่อห้อง โน้ตตัวดำได้ 1 จังหวะ พบบ่อยที่สุดในเพลงป๊อป/ร็อกทั่วไป บางทีเขียนย่อเป็นสัญลักษณ์ C',
          '3/4 — 3 จังหวะต่อห้อง โน้ตตัวดำได้ 1 จังหวะ ให้ความรู้สึกโยกเยกแบบวอลทซ์ (waltz) นับ 1-2-3 1-2-3',
          '2/4 — 2 จังหวะต่อห้อง โน้ตตัวดำได้ 1 จังหวะ ให้ความรู้สึกหนักแน่นแบบเพลงมาร์ช',
          "6/8 — 6 จังหวะต่อห้อง โน้ตเขบ็ตหนึ่งชั้นได้ 1 จังหวะ (หมายเหตุ: ในเพลงจริง 6/8 มักถูก 'รู้สึก' เป็น 2 ห้วงใหญ่ ห้วงละ 3 ไม่ใช่นับทีละ 1 ถึง 6 ตรงๆ — แต่บทนี้ขอเริ่มจากการนับพื้นฐานตามตัวเลขไปก่อน ยังไม่ลงลึกเรื่องจังหวะผสม)"
        ],
        [
          "4/4 (Common Time) — 4 beats per measure, quarter note gets 1 beat. The most common meter in pop/rock, sometimes written as a 'C' symbol.",
          '3/4 — 3 beats per measure, quarter note gets 1 beat. Has a swaying waltz feel, counted 1-2-3, 1-2-3.',
          '2/4 — 2 beats per measure, quarter note gets 1 beat. Has a strong marching feel.',
          "6/8 — 6 beats per measure, eighth note gets 1 beat. (Note: in real music, 6/8 is usually 'felt' as 2 big groups of 3, not counted straight 1 through 6 — but this lesson starts with basic numeric counting, without compound meter feel yet.)"
        ]),
      quizTimeSigBeatsItem(4, 4),
      quizTimeSigUnitItem(4, 4),
      quizTimeSigBeatsItem(3, 4),
      quizTimeSigUnitItem(3, 4),
      quizTimeSigBeatsItem(2, 4),
      quizTimeSigUnitItem(2, 4),
      quizTimeSigBeatsItem(6, 8),
      quizTimeSigUnitItem(6, 8)
    ]
  },
  {
    id: 'scales',
    label: { th: 'บันไดเสียง (C Major)', en: 'Scales (C Major)' },
    group: { th: 'ทฤษฎีดนตรีพื้นฐาน', en: 'Music Theory Basics' },
    items: [
      readingItem('บันไดเสียงเมเจอร์คืออะไร', 'What Is a Major Scale',
        [
          'บันไดเสียงเมเจอร์ (Major Scale) คือชุดโน้ต 8 ตัวเรียงกันตามรูปแบบระยะห่างที่ตายตัว: เต็มเสียง-เต็มเสียง-ครึ่งเสียง-เต็มเสียง-เต็มเสียง-เต็มเสียง-ครึ่งเสียง (ย่อว่า W-W-H-W-W-W-H)',
          "'เต็มเสียง' (Whole step) และ 'ครึ่งเสียง' (Half step) คือระยะห่างระหว่างโน้ต 2 ตัวที่อยู่ติดกัน — บนคีย์เปียโน ครึ่งเสียงคือ 1 คีย์ถัดไป (นับรวมคีย์ดำ) ส่วนเต็มเสียงคือข้าม 2 คีย์",
          'บันไดเสียง C Major คือ C-D-E-F-G-A-B แล้ววนกลับมา C (สูงกว่าเดิม 1 ออกเทฟ) — ใช้แค่คีย์ขาวทั้งหมด ไม่มีเครื่องหมาย # หรือ ♭ เลย จึงเป็นบันไดเสียงแรกที่นักดนตรีมือใหม่มักเรียนก่อน'
        ],
        [
          'The Major Scale is a set of 8 notes arranged in a fixed pattern of gaps: Whole-Whole-Half-Whole-Whole-Whole-Half (shortened to W-W-H-W-W-W-H).',
          "A 'Whole step' and 'Half step' are the distance between two adjacent notes — on a piano keyboard, a half step is one key over (counting black keys), and a whole step skips two keys.",
          "The C Major scale is C-D-E-F-G-A-B, then back to C (one octave higher) — using only white keys, with no sharps or flats at all. That's usually the first scale beginner musicians learn."
        ]),
      readingItem('ทำไม C Major ไม่มี # หรือ ♭', 'Why C Major Has No Sharps or Flats',
        [
          'ทำไม C Major ไม่ต้องมี # หรือ ♭ เลย? เพราะครึ่งเสียงตามธรรมชาติบนคีย์เปียโน (ไม่มีคีย์ดำคั่น) เกิดขึ้นพอดีระหว่าง E-F และ B-C เท่านั้น',
          'ลองไล่ดู: C→D (เต็มเสียง), D→E (เต็มเสียง), E→F (ครึ่งเสียง — ไม่มีคีย์ดำคั่น!), F→G (เต็มเสียง), G→A (เต็มเสียง), A→B (เต็มเสียง), B→C (ครึ่งเสียง — ไม่มีคีย์ดำคั่นอีกครั้ง!) — ตรงกับรูปแบบ W-W-H-W-W-W-H เป๊ะ',
          'บทถัดไปจะให้ทายว่าโน้ตตัวที่เท่าไหร่ในบันไดเสียง C Major คือตัวอะไร ลองท่องบันไดเสียง C-D-E-F-G-A-B-C ให้คล่องก่อนเริ่มทำ'
        ],
        [
          'Why does C Major need no sharps or flats at all? Because the natural half steps on a piano (where there\'s no black key in between) occur exactly between E-F and B-C.',
          'Walk through it: C→D (whole), D→E (whole), E→F (half — no black key between them!), F→G (whole), G→A (whole), A→B (whole), B→C (half — no black key again!) — matching the W-W-H-W-W-W-H pattern exactly.',
          'The next lesson will ask you to name the Nth note of the C Major scale. Try reciting C-D-E-F-G-A-B-C a few times before you start.'
        ]),
      quizScaleItem(1),
      quizScaleItem(5),
      quizScaleItem(8),
      quizScaleItem(3),
      quizScaleItem(6),
      quizScaleItem(2),
      quizScaleItem(4),
      quizScaleItem(7)
    ]
  },
  {
    id: 'chords',
    label: { th: 'คอร์ดเบื้องต้น', en: 'Basic Chords' },
    group: { th: 'ทฤษฎีดนตรีพื้นฐาน', en: 'Music Theory Basics' },
    items: [
      readingItem('คอร์ดคืออะไร', 'What Is a Chord',
        [
          "คอร์ด (Chord) คือกลุ่มโน้ตตั้งแต่ 3 ตัวขึ้นไปที่เล่นพร้อมกัน ให้เสียงประสานที่ฟังกลมกลืน — คอร์ด 3 โน้ตเรียกว่า 'ไทรแอด' (Triad)",
          'ไทรแอดสร้างจากการ "ซ้อนสาม" (stack thirds) บนบันไดเสียง: เริ่มจากโน้ตราก (root) แล้วข้ามขึ้นไป 1 ตัวเป็นโน้ตที่ 3 (3rd) แล้วข้ามขึ้นไปอีก 1 ตัวเป็นโน้ตที่ 5 (5th)',
          'เช่น ไทรแอด C: เริ่มจาก C (root) ข้ามไป E (3rd) ข้ามไป G (5th) → คอร์ด C ประกอบด้วยโน้ต C-E-G'
        ],
        [
          "A Chord is a group of 3 or more notes played together, creating harmony — a 3-note chord is called a 'Triad'.",
          'A triad is built by "stacking thirds" on a scale: start from a root note, skip up to the 3rd note (the 3rd), then skip up again to the 5th note (the 5th).',
          'For example, the C triad: start at C (root), skip to E (3rd), skip to G (5th) → the C chord is made of C-E-G.'
        ]),
      readingItem('คอร์ดเมเจอร์ vs ไมเนอร์', 'Major vs Minor Chords',
        [
          "สิ่งที่ทำให้คอร์ดฟังดู 'สดใส' (เมเจอร์) หรือ 'เศร้า/มืดหม่น' (ไมเนอร์) คือระยะห่างระหว่างโน้ตรากกับโน้ตที่ 3 เท่านั้น — โน้ตรากกับโน้ตที่ 5 เหมือนกันทั้งคู่",
          'คอร์ดเมเจอร์: root ถึง 3rd ห่าง 4 ครึ่งเสียง (major 3rd) เช่น คอร์ด C Major = C-E-G',
          'คอร์ดไมเนอร์: root ถึง 3rd ห่างแค่ 3 ครึ่งเสียง (minor 3rd, ใกล้กว่าเมเจอร์นิดเดียว) เช่น คอร์ด D minor = D-F-A'
        ],
        [
          "What makes a chord sound 'bright' (major) or 'sad/dark' (minor) is only the distance between the root and the 3rd — the root and 5th are the same in both.",
          'Major chord: root to 3rd is 4 half steps (a major 3rd) — e.g. C Major = C-E-G.',
          'Minor chord: root to 3rd is only 3 half steps (a minor 3rd, just slightly closer than major) — e.g. D minor = D-F-A.'
        ]),
      readingItem('คอร์ดไทรแอดทั้ง 7 ใน C Major', 'The 7 Triads of C Major',
        [
          "ถ้าสร้างไทรแอดบนโน้ตทุกตัวของบันไดเสียง C Major (ใช้แค่โน้ตในบันไดเสียง ไม่มี # หรือ ♭) จะได้คอร์ดที่ 'อยู่ในคีย์' (diatonic) ทั้งหมด 7 คอร์ด แต่ละคอร์ดมีคุณภาพต่างกันตามธรรมชาติ",
          'I=C Major, ii=D minor, iii=E minor, IV=F Major, V=G Major, vi=A minor, vii°=B diminished (ตัวใหญ่แทนเมเจอร์ ตัวเล็กแทนไมเนอร์ สัญลักษณ์ ° แทนดิมินิชด์)',
          'สังเกตแพทเทิร์น: เมเจอร์-ไมเนอร์-ไมเนอร์-เมเจอร์-เมเจอร์-ไมเนอร์-ดิมินิชด์ (M-m-m-M-M-m-dim) แพทเทิร์นนี้เกิดจาก W-W-H-W-W-W-H ของบันไดเสียงเมเจอร์เป๊ะๆ — บทนี้จะฝึกแค่ 6 คอร์ดแรก (เมเจอร์/ไมเนอร์) ยังไม่รวม vii° diminished ซึ่งมีเสียงตึงเครียดเฉพาะตัว'
        ],
        [
          "If you build a triad on every note of the C Major scale (using only notes in the scale, no sharps/flats), you get 7 chords that are all 'in the key' (diatonic) — each with a naturally different quality.",
          'I=C Major, ii=D minor, iii=E minor, IV=F Major, V=G Major, vi=A minor, vii°=B diminished (capital = major, lowercase = minor, ° = diminished).',
          "Notice the pattern: Major-minor-minor-Major-Major-minor-diminished (M-m-m-M-M-m-dim) — this pattern comes directly from the major scale's W-W-H-W-W-W-H formula. This lesson practices only the first 6 chords (major/minor) — not vii° diminished, which has its own tense sound."
        ]),
      quizChordQualityItem(CHORDS[0]), quizChordRootItem(CHORDS[0]),
      quizChordQualityItem(CHORDS[1]), quizChordRootItem(CHORDS[1]),
      quizChordQualityItem(CHORDS[2]), quizChordRootItem(CHORDS[2]),
      quizChordQualityItem(CHORDS[3]), quizChordRootItem(CHORDS[3]),
      quizChordQualityItem(CHORDS[4]), quizChordRootItem(CHORDS[4]),
      quizChordQualityItem(CHORDS[5]), quizChordRootItem(CHORDS[5])
    ]
  },
  {
    id: 'piano',
    label: { th: 'หัดเล่นเปียโน/คีย์บอร์ด', en: 'Piano / Keyboard' },
    group: { th: 'เครื่องดนตรี', en: 'Instruments' },
    items: [
      readingItem('รู้จักคีย์เปียโน', 'Meet the Piano Keys',
        [
          'คีย์เปียโนมี 2 แบบ: คีย์ขาว (white keys) เป็นโน้ตธรรมชาติ 7 ตัว (C D E F G A B) เรียงกันซ้ำไปเรื่อยๆ และคีย์ดำ (black keys) ที่แทรกอยู่ระหว่างคีย์ขาวบางคู่',
          'คีย์ดำจะรวมกันเป็นกลุ่มละ 2 ตัว สลับกับกลุ่มละ 3 ตัว ซ้ำไปเรื่อยๆ ตลอดคีย์บอร์ด — ใช้กลุ่มนี้เป็นจุดสังเกตหาโน้ตได้ง่ายมาก',
          'โน้ต C คือคีย์ขาวที่อยู่ทางซ้ายของกลุ่มคีย์ดำ 2 ตัวเสมอ ส่วนโน้ต F คือคีย์ขาวที่อยู่ทางซ้ายของกลุ่มคีย์ดำ 3 ตัวเสมอ — จำจุดสังเกตนี้แล้วจะหาโน้ตอื่นๆ ได้ง่ายด้วยการนับต่อจากตรงนี้'
        ],
        [
          'Piano keys come in 2 types: white keys are the 7 natural notes (C D E F G A B) repeating over and over, and black keys sit between certain pairs of white keys.',
          'Black keys cluster in groups of 2, alternating with groups of 3, repeating all the way across the keyboard — use these groups as landmarks to find notes easily.',
          'C is always the white key just to the left of a group of 2 black keys. F is always the white key just to the left of a group of 3 black keys — remember these landmarks and count outward to find any other note.'
        ]),
      readingItem('คอร์ดบนเปียโน', 'Chords on Piano',
        [
          'การเล่นคอร์ดบนเปียโนคือการกดโน้ต 3 ตัว (root, 3rd, 5th) พร้อมกัน — ตำแหน่งเดียวกับที่เรียนไปในบทคอร์ดเบื้องต้น แค่เปลี่ยนจากดูบนบรรทัด 5 เส้น มาดูบนคีย์เปียโนแทน',
          "เทคนิคจำง่ายๆ: กดคีย์ขาว 3 ตัว แบบ 'เว้น 1 คีย์ขาว' ทุกครั้ง (root → ข้าม 1 → 3rd → ข้าม 1 → 5th) จะได้ไทรแอด diatonic ของ C Major เป๊ะ ไม่ว่าจะเริ่มจากคีย์ขาวตัวไหน",
          'ลองไล่ดู: เริ่ม C ข้าม D ไป E ข้าม F ไป G → C-E-G (คอร์ด C Major) — เริ่ม D ข้าม E ไป F ข้าม G ไป A → D-F-A (คอร์ด D minor) ใช้วิธีเดียวกันได้กับทุกคอร์ดในบทที่แล้ว'
        ],
        [
          'Playing a chord on piano means pressing 3 notes (root, 3rd, 5th) at the same time — the same positions from the Basic Chords lesson, just viewed on piano keys instead of the staff.',
          "Easy trick: press 3 white keys, always 'skipping 1 white key' each time (root → skip 1 → 3rd → skip 1 → 5th), and you get a diatonic C Major triad exactly — no matter which white key you start on.",
          'Try it: start C, skip D, land E, skip F, land G → C-E-G (C Major chord) — start D, skip E, land F, skip G, land A → D-F-A (D minor chord). Same method works for every chord from the last lesson.'
        ]),
      readingItem('โพรเกรสชันสี่คอร์ดสุดฮิต (I-V-vi-IV)', 'The Famous 4-Chord Progression (I-V-vi-IV)',
        [
          "'I-V-vi-IV' คือลำดับคอร์ด 4 ตัวที่นักแต่งเพลงป๊อปทั่วโลกใช้ซ้ำแล้วซ้ำอีกนับพันเพลง (ในคีย์ C คือ C-G-Am-F) เพราะให้ความรู้สึกลื่นไหลและติดหูง่าย",
          'ลองกดตามลำดับนี้บนเปียโน: C major (C-E-G) → G major (G-B-D) → A minor (A-C-E) → F major (F-A-C) แล้ววนกลับไป C ใหม่ — จะรู้สึกคุ้นหูมากเพราะเพลงดังหลายเพลงใช้ลำดับนี้',
          'แบบฝึกหัดถัดไปจะฝึกจำตำแหน่งคอร์ดทั้ง 4 ตัวนี้บนเปียโนให้คล่อง (I=C Major, V=G Major, vi=A minor, IV=F Major)'
        ],
        [
          "'I-V-vi-IV' is a 4-chord sequence pop songwriters worldwide have reused in thousands of songs (in the key of C: C-G-Am-F) because it feels smooth and instantly catchy.",
          'Try pressing this order on piano: C major (C-E-G) → G major (G-B-D) → A minor (A-C-E) → F major (F-A-C), then loop back to C — it\'ll sound familiar since many hit songs use exactly this progression.',
          'The next exercises will drill these 4 chord positions on piano until they\'re second nature (I=C Major, V=G Major, vi=A minor, IV=F Major).'
        ]),
      quizPianoNoteItem(0), quizPianoNoteItem(4), quizPianoNoteItem(7), quizPianoNoteItem(2),
      quizPianoNoteItem(9), quizPianoNoteItem(5), quizPianoNoteItem(11), quizPianoNoteItem(1),
      quizPianoNoteItem(8), quizPianoNoteItem(13),
      quizPianoChordQualityItem(CHORDS[0]), quizPianoChordRootItem(CHORDS[0]),
      quizPianoChordQualityItem(CHORDS[4]), quizPianoChordRootItem(CHORDS[4]),
      quizPianoChordQualityItem(CHORDS[5]), quizPianoChordRootItem(CHORDS[5]),
      quizPianoChordQualityItem(CHORDS[3]), quizPianoChordRootItem(CHORDS[3])
    ]
  },
  {
    id: 'guitar',
    label: { th: 'หัดเล่นกีตาร์', en: 'Guitar' },
    group: { th: 'เครื่องดนตรี', en: 'Instruments' },
    items: [
      readingItem('อ่านไดอะแกรมคอร์ดกีตาร์', 'Reading a Guitar Chord Diagram',
        [
          "ไดอะแกรมคอร์ดกีตาร์แสดงคอกีตาร์ในแนวตั้ง: เส้นแนวตั้ง 6 เส้นคือสายกีตาร์ (จากซ้าย = สาย 6 เสียงต่ำสุด E ไปขวา = สาย 1 เสียงสูงสุด E) เส้นหนาบนสุดคือ 'นัท' (nut) จุดเริ่มคอ เส้นแนวนอนที่เหลือคือเฟรต (fret)",
          "จุดกลม (●) วางบนตำแหน่งที่ต้องกดสาย ที่เฟรตนั้นๆ — วงกลมโปร่ง (○) เหนือนัทหมายถึงดีดสายเปล่า (open string) ไม่ต้องกด — เครื่องหมายกากบาท (×) หมายถึงห้ามดีดสายนั้น (mute/skip)",
          'เช่น ถ้าสาย A (สาย 5) มีจุด ● อยู่ตรงเฟรต 2 หมายถึงกดสาย A ที่ช่องเฟรตที่ 2 แล้วดีด'
        ],
        [
          "A guitar chord diagram shows the neck vertically: 6 vertical lines are the strings (left = string 6, lowest E; right = string 1, highest E). The thick top line is the 'nut' (start of the neck); the remaining horizontal lines are frets.",
          'A filled dot (●) marks where to press that string at that fret. An open circle (○) above the nut means play that string open (no pressing). An X (×) means skip/mute that string entirely.',
          'For example, if the A string (string 5) has a dot ● at fret 2, that means press the A string at the 2nd fret, then strum it.'
        ]),
      readingItem('คอร์ดเปิดพื้นฐาน 8 คอร์ด', 'The 8 Basic Open Chords',
        [
          'คอร์ดเปิด (Open Chords) คือคอร์ดที่ใช้สายเปล่าผสมกับสายที่กด — เล่นง่ายเพราะไม่ต้องกดครบทุกสาย เหมาะเป็นคอร์ดแรกที่มือใหม่ทุกคนต้องเรียน',
          "คอร์ดเมเจอร์เปิดยอดฮิต 5 ตัว (บางทีเรียก 'CAGED': C, A, G, E, D) และคอร์ดไมเนอร์เปิดพื้นฐาน 3 ตัว (Em, Am, Dm) — 8 คอร์ดนี้เล่นเพลงกีตาร์ได้หลายพันเพลง",
          'แบบฝึกหัดถัดไปจะโชว์ไดอะแกรม ให้ทายว่าเป็นคอร์ดอะไร — สังเกตรูปแบบจุด/กากบาท/วงกลมโปร่งให้ดี แต่ละคอร์ดมีรูปทรงเฉพาะตัวจำได้ไม่ยาก'
        ],
        [
          "Open Chords use a mix of open (unpressed) and fretted strings — easier to play since you don't need to press every string, making them the first chords every beginner learns.",
          "The 5 most popular open major chords (sometimes called 'CAGED': C, A, G, E, D) plus 3 basic open minor chords (Em, Am, Dm) — these 8 chords alone can play thousands of songs.",
          "The next exercises will show a diagram and ask you to name the chord — pay attention to the pattern of dots/X's/circles; each chord has its own distinct, memorable shape."
        ]),
      quizGuitarChordItem(GUITAR_CHORDS[0]), quizGuitarChordItem(GUITAR_CHORDS[1]),
      quizGuitarChordItem(GUITAR_CHORDS[2]), quizGuitarChordItem(GUITAR_CHORDS[3]),
      quizGuitarChordItem(GUITAR_CHORDS[4]), quizGuitarChordItem(GUITAR_CHORDS[5]),
      quizGuitarChordItem(GUITAR_CHORDS[6]), quizGuitarChordItem(GUITAR_CHORDS[7])
    ]
  },
  {
    id: 'ukulele',
    label: { th: 'หัดเล่นอูคูเลเล่', en: 'Ukulele' },
    group: { th: 'เครื่องดนตรี', en: 'Instruments' },
    items: [
      readingItem('รู้จักอูคูเลเล่', 'Meet the Ukulele',
        [
          'อูคูเลเล่ (Ukulele) เป็นเครื่องดนตรีตระกูลกีตาร์ขนาดเล็ก มีแค่ 4 สาย (กีตาร์มี 6 สาย) เสียงใส สดใส น้ำหนักเบา พกพาง่าย เหมาะเป็นเครื่องดนตรีแรกสำหรับมือใหม่มาก',
          "สายทั้ง 4 เรียงจากซ้ายไปขวาบนไดอะแกรม (เหมือนกีตาร์) คือ G-C-E-A — จุดพิเศษของอูคูเลเล่คือสาย G (สายซ้ายสุด) มักตั้งเสียง 'สูง' กว่าสาย C ข้างๆ (เรียกว่า re-entrant tuning) ทำให้ได้เสียงกรุ๊งกริ๊งเป็นเอกลักษณ์",
          'เพราะมีแค่ 4 สาย คอร์ดอูคูเลเล่จึงกดง่ายกว่ากีตาร์มาก บางคอร์ดกดแค่นิ้วเดียวก็เล่นได้แล้ว!'
        ],
        [
          'The Ukulele is a small guitar-family instrument with just 4 strings (guitar has 6). It has a bright, cheerful sound, light weight, and is easy to carry — a great first instrument for beginners.',
          "The 4 strings, left to right on the diagram (like guitar), are G-C-E-A — a unique feature is that the G string (leftmost) is usually tuned 'higher' than the neighboring C string (called re-entrant tuning), giving that signature jangly sound.",
          'Because there are only 4 strings, ukulele chords are much easier to press than guitar — some chords only need a single finger!'
        ]),
      readingItem('คอร์ดพื้นฐาน 4 คอร์ด: C-G-Am-F', 'The 4 Basic Chords: C-G-Am-F',
        [
          'สังเกตไหมว่าชื่อคอร์ดพวกนี้คุ้นๆ? ใช่แล้ว — คือโพรเกรสชัน I-V-vi-IV เดียวกับที่เรียนไปตอนเล่นเปียโน/กีตาร์เลย! บนอูคูเลเล่คอร์ดเหล่านี้ก็ยังคงเป็นคอร์ดเปิดง่ายๆ เหมือนกัน',
          'คอร์ด C บนอูคูเลเล่พิเศษมาก — กดแค่สาย A (ขวาสุด) เฟรต 3 ด้วยนิ้วเดียว สายอื่นดีดเปล่าหมด ง่ายที่สุดในบรรดาคอร์ดทั้งหมด!',
          'แบบฝึกหัดถัดไปจะโชว์ไดอะแกรม ให้ทายว่าเป็นคอร์ดอะไร ลองกดตามในใจแล้วนึกภาพเสียงตามไปด้วย'
        ],
        [
          "Notice these chord names look familiar? That's right — it's the same I-V-vi-IV progression from the piano/guitar lessons! On ukulele, these are also simple open chords.",
          'The C chord on ukulele is especially special — just press the A string (rightmost) at fret 3 with one finger, strum all the other strings open. The easiest chord of them all!',
          'The next exercises will show a diagram and ask you to name the chord — try pressing along in your mind and imagining the sound.'
        ]),
      quizUkuleleChordItem(UKULELE_CHORDS[0]), quizUkuleleChordItem(UKULELE_CHORDS[1]),
      quizUkuleleChordItem(UKULELE_CHORDS[2]), quizUkuleleChordItem(UKULELE_CHORDS[3]),
      quizUkuleleChordItem(UKULELE_CHORDS[2]), quizUkuleleChordItem(UKULELE_CHORDS[3]),
      quizUkuleleChordItem(UKULELE_CHORDS[0]), quizUkuleleChordItem(UKULELE_CHORDS[1])
    ]
  },
  {
    id: 'drums',
    label: { th: 'หัดเล่นกลองชุด', en: 'Drum Kit' },
    group: { th: 'เครื่องดนตรี', en: 'Instruments' },
    items: [
      readingItem('รู้จักกลองชุดพื้นฐาน', 'Meet the Basic Drum Kit',
        [
          'กลองชุด (Drum Kit) ประกอบด้วยชิ้นส่วนหลัก 3 อย่างที่มือใหม่ต้องรู้จักก่อน: กระเดื่อง/เบสดรัม (Kick) เสียงทุ้มหนักตีด้วยเท้า, สแนร์ (Snare) เสียงแหลมคมกลางลำตัวตีด้วยไม้, และไฮแฮต (Hi-Hat) เสียงชิกๆ สั้นกระชับตีด้วยไม้เช่นกัน',
          "ต่างจากเครื่องดนตรีมีระดับเสียง (เปียโน/กีตาร์) กลองไม่มีโน้ตที่ระบุระดับเสียงสูง-ต่ำ แต่บอกแค่ 'จังหวะ' และ 'ชิ้นไหนตี' — บทนี้จึงใช้ตารางกริดแทนโน้ตดนตรี: แต่ละคอลัมน์คือ 1 จังหวะ แต่ละแถวคือชิ้นส่วนกลอง",
          "ฝึกจำเสียงแต่ละชิ้นด้วยหูก่อน: Kick เสียงทุ้ม 'ตุม', Snare เสียงแหลมคม 'แต้ก', Hi-Hat เสียงสั้นกระชับ 'ชิก' — แบบฝึกหัดถัดไปจะให้ฟังแล้วทายว่าเป็นชิ้นไหน"
        ],
        [
          "A drum kit has 3 core pieces every beginner learns first: the Kick (bass drum) — a deep low thump played with the foot; the Snare — a sharp, crisp sound in the middle played with a stick; and the Hi-Hat — a short, tight 'chick' sound also played with a stick.",
          "Unlike pitched instruments (piano/guitar), drums don't have notes for high/low pitch — they only show 'when' and 'which piece'. This lesson uses a grid instead of music notation: each column is one beat, each row is a drum piece.",
          "First train your ear to recognize each sound: Kick is a deep 'thud', Snare is a sharp 'crack', Hi-Hat is a short tight 'chick' — the next exercises will play a sound and ask you to identify which piece it is."
        ]),
      quizDrumEarItem('kick'), quizDrumEarItem('snare'), quizDrumEarItem('hihat'),
      quizDrumEarItem('snare'), quizDrumEarItem('kick'), quizDrumEarItem('hihat'),
      Object.assign(
        readingItem('จังหวะร็อกพื้นฐาน (Basic Rock Beat)', 'The Basic Rock Beat',
          [
            'จังหวะร็อกพื้นฐาน (Basic Rock Beat) เป็นแพทเทิร์นกลองที่พบได้ในเพลงป๊อป/ร็อกนับไม่ถ้วน นับ 4 จังหวะ (1-2-3-4) วนซ้ำ: Kick ตกที่จังหวะ 1 และ 3, Snare ตกที่จังหวะ 2 และ 4, ส่วน Hi-Hat ตีทุกจังหวะต่อเนื่องเป็นตัวคุมจังหวะ',
            "ลองนับออกเสียง '1-2-3-4' พร้อมจินตนาการ: จังหวะ 1='ตุม' (kick) จังหวะ 2='แต้ก' (snare) จังหวะ 3='ตุม' (kick) จังหวะ 4='แต้ก' (snare) — ไฮแฮตแทรกอยู่ทุกจังหวะเป็นพื้นเสียง",
            'แบบฝึกหัดถัดไปจะถามว่าจังหวะที่กำหนดมีชิ้นกลองไหนตีอยู่บ้าง'
          ],
          [
            "The Basic Rock Beat is a drum pattern found in countless pop/rock songs. Counting 4 beats (1-2-3-4) on a loop: the Kick lands on beats 1 and 3, the Snare lands on beats 2 and 4, while the Hi-Hat plays every beat continuously to keep time.",
            "Try counting out loud '1-2-3-4' while imagining: beat 1 = 'thud' (kick), beat 2 = 'crack' (snare), beat 3 = 'thud' (kick), beat 4 = 'crack' (snare) — the hi-hat is woven through every beat as the steady backdrop.",
            'The next exercises will ask which drum piece(s) play on a given beat.'
          ]),
        { drumBeat: true }
      ),
      mcqItem(
        'จังหวะที่ 1 ของจังหวะร็อกพื้นฐาน มีชิ้นกลองไหนตีอยู่บ้าง?', 'Which drum piece(s) play on beat 1 of the Basic Rock Beat?',
        [mcqOpt('a', 'Kick + Hi-Hat', 'Kick + Hi-Hat'), mcqOpt('b', 'Snare + Hi-Hat', 'Snare + Hi-Hat'),
         mcqOpt('c', 'Kick เท่านั้น', 'Kick only'), mcqOpt('d', 'Snare เท่านั้น', 'Snare only')],
        'a'
      ),
      mcqItem(
        'จังหวะที่ 2 ของจังหวะร็อกพื้นฐาน มีชิ้นกลองไหนตีอยู่บ้าง?', 'Which drum piece(s) play on beat 2 of the Basic Rock Beat?',
        [mcqOpt('a', 'Kick + Hi-Hat', 'Kick + Hi-Hat'), mcqOpt('b', 'Snare + Hi-Hat', 'Snare + Hi-Hat'),
         mcqOpt('c', 'Kick เท่านั้น', 'Kick only'), mcqOpt('d', 'Snare เท่านั้น', 'Snare only')],
        'b'
      ),
      mcqItem(
        'จังหวะที่ 3 ของจังหวะร็อกพื้นฐาน มีชิ้นกลองไหนตีอยู่บ้าง?', 'Which drum piece(s) play on beat 3 of the Basic Rock Beat?',
        [mcqOpt('a', 'Kick + Hi-Hat', 'Kick + Hi-Hat'), mcqOpt('b', 'Snare + Hi-Hat', 'Snare + Hi-Hat'),
         mcqOpt('c', 'Kick เท่านั้น', 'Kick only'), mcqOpt('d', 'Snare เท่านั้น', 'Snare only')],
        'a'
      ),
      mcqItem(
        'จังหวะที่ 4 ของจังหวะร็อกพื้นฐาน มีชิ้นกลองไหนตีอยู่บ้าง?', 'Which drum piece(s) play on beat 4 of the Basic Rock Beat?',
        [mcqOpt('a', 'Kick + Hi-Hat', 'Kick + Hi-Hat'), mcqOpt('b', 'Snare + Hi-Hat', 'Snare + Hi-Hat'),
         mcqOpt('c', 'Kick เท่านั้น', 'Kick only'), mcqOpt('d', 'Snare เท่านั้น', 'Snare only')],
        'b'
      ),
      mcqItem(
        'ครบ 1 ห้อง (4 จังหวะ) ของจังหวะร็อกพื้นฐาน Kick ตีทั้งหมดกี่ครั้ง?', 'In one full measure (4 beats) of the Basic Rock Beat, how many times does the Kick hit?',
        [mcqOpt('a', '1 ครั้ง', '1 time'), mcqOpt('b', '2 ครั้ง', '2 times'),
         mcqOpt('c', '3 ครั้ง', '3 times'), mcqOpt('d', '4 ครั้ง', '4 times')],
        'b'
      ),
      mcqItem(
        'Snare ตกที่จังหวะไหนบ้างในจังหวะร็อกพื้นฐาน?', 'Which beats does the Snare land on in the Basic Rock Beat?',
        [mcqOpt('a', 'จังหวะ 1 และ 3', 'Beats 1 and 3'), mcqOpt('b', 'จังหวะ 2 และ 4', 'Beats 2 and 4'),
         mcqOpt('c', 'ทุกจังหวะ', 'Every beat'), mcqOpt('d', 'จังหวะ 1 เท่านั้น', 'Beat 1 only')],
        'b'
      )
    ]
  },
  {
    id: 'violin',
    label: { th: 'หัดเล่นไวโอลิน', en: 'Violin' },
    group: { th: 'เครื่องดนตรี', en: 'Instruments' },
    items: [
      readingItem('รู้จักไวโอลิน', 'Meet the Violin',
        [
          "ไวโอลิน (Violin) เป็นเครื่องสายที่เล่นด้วยการสี 'คันชัก' (bow) ผ่านสาย หรือบางครั้งใช้นิ้วดีด (pizzicato) — ต่างจากกีตาร์/อูคูเลเล่ตรงที่ไวโอลิน 'ไม่มีเฟรต' บนคอ ผู้เล่นต้องหาตำแหน่งเสียงด้วยความเคยชินของนิ้วและหูล้วนๆ",
          'ไวโอลินมี 4 สาย ตั้งเสียงห่างกันเป็นคู่ 5 (Perfect 5th) ทุกคู่ เรียงจากต่ำไปสูง: G3 - D4 - A4 - E5 — สังเกตว่าคู่ 5 คือขั้นคู่เสียงเดียวกับที่เคยฝึกฟังในบทฝึกหูขั้นสูงเลย!',
          'โน้ตไวโอลินเขียนด้วยกุญแจซอล (Treble Clef) เพียงกุญแจเดียวเท่านั้น (ต่างจากเปียโนที่ต้องใช้ทั้งกุญแจซอลและฟา) ทฤษฎีที่เรียนมาทั้งหมดในบทอ่านโน้ตกุญแจซอลใช้ได้กับไวโอลินตรงๆ'
        ],
        [
          "The Violin is a string instrument played by drawing a 'bow' across the strings, or sometimes plucked with a finger (pizzicato) — unlike guitar/ukulele, the violin has NO frets on its neck. Players find pitches purely through finger muscle memory and ear.",
          'The violin has 4 strings tuned a perfect 5th apart each, low to high: G3 - D4 - A4 - E5 — notice that a 5th is the exact same interval you practiced listening for in the Advanced Ear Training lesson!',
          'Violin music is written in Treble Clef only (unlike piano, which needs both treble and bass) — everything you learned in the treble clef reading lesson applies directly to violin.'
        ]),
      quizViolinStringItem('G'), quizViolinStringItem('D'), quizViolinStringItem('A'), quizViolinStringItem('E'),
      quizViolinStringItem('A'), quizViolinStringItem('E'), quizViolinStringItem('G'), quizViolinStringItem('D'),
      readingItem('โน้ตบนไวโอลินอ่านด้วยกุญแจซอล', 'Violin Notes on the Treble Staff',
        [
          'สาย A (สายเปิดเส้นที่ 3) ตรงกับโน้ต A4 ซึ่งอยู่บนบรรทัดเพลงกุญแจซอลพอดี ส่วนสาย E (สายเปิดสูงสุด) ตรงกับโน้ต E5',
          'ลองอ่านตำแหน่งโน้ตทั้งสองนี้บนบรรทัดเพลงในแบบฝึกหัดถัดไป — ใช้ทักษะอ่านโน้ตกุญแจซอลที่เรียนมาแล้วได้เลย ไม่ต้องเรียนใหม่',
          'ส่วนสาย G และสาย D อยู่ต่ำกว่าบรรทัดเพลง 5 เส้น (ต้องใช้เส้นน้อยเสริม) บทนี้จึงยังไม่ลงรายละเอียดตำแหน่งของสองสายนั้นบนโน้ต แต่จำเสียงจากการฝึกหูที่ผ่านมาได้แล้ว'
        ],
        [
          'The A string (3rd open string) matches the note A4, which sits right on the treble staff. The E string (highest open string) matches the note E5.',
          "Try reading these two note positions on the staff in the next exercises — use the treble-clef reading skill you already learned, nothing new to study.",
          "The G and D strings sit below the 5-line staff (needing extra ledger lines), so this lesson doesn't cover their exact notated position yet — but you already know their sound from the ear-training exercises above."
        ]),
      quizNoteItem(3), quizNoteItem(7), quizNoteItem(3), quizNoteItem(7)
    ]
  },
  {
    id: 'ear-training',
    label: { th: 'ฝึกหูดนตรี', en: 'Ear Training' },
    group: { th: 'ฝึกหู', en: 'Ear Training' },
    items: [
      readingItem('ฝึกหูดนตรีคืออะไร', 'What Is Ear Training',
        [
          'ฝึกหูดนตรี (Ear Training) คือการฝึกให้หูจดจำและแยกแยะเสียงดนตรีได้ โดยไม่ต้องดูโน้ตเลย — ทักษะนี้ช่วยให้เล่นตามเพลงที่ได้ยินได้ (play by ear), แกะเพลง, และแต่งเพลงได้ไวขึ้น',
          "ทุกคนฝึกฟังแบบนี้ได้ ไม่จำเป็นต้องมี 'พรสวรรค์หูทิพย์' — เริ่มจากทักษะพื้นฐานที่สุดก่อน: แยกเสียงสูง/ต่ำ และแยกว่าสองเสียงเหมือนกันหรือต่างกัน แล้วค่อยไปถึงการแยกคอร์ดเมเจอร์/ไมเนอร์ด้วยหู",
          'กดปุ่ม 🔊 ฟังเสียง ได้ไม่จำกัดจำนวนครั้งในแต่ละข้อ ฟังซ้ำได้เรื่อยๆ จนกว่าจะมั่นใจแล้วค่อยตอบ'
        ],
        [
          "Ear Training means training your ear to recognize and distinguish musical sounds without looking at any notation — this skill helps you play songs by ear, transcribe music, and compose faster.",
          "Anyone can train this — you don't need a 'natural gift.' Start with the most basic skills: telling high from low pitch, and telling whether two pitches are the same or different, then move up to recognizing major vs minor chords by ear.",
          "Click the 🔊 Listen button as many times as you like on each question — replay until you're confident, then answer."
        ]),
      quizPitchCompareItem('C', 4, 'G', 4),
      quizPitchCompareItem('G', 4, 'C', 4),
      quizPitchCompareItem('C', 4, 'D', 4),
      quizPitchCompareItem('E', 5, 'C', 4),
      quizPitchSameDiffItem('C', 4, 'C', 4),
      quizPitchSameDiffItem('C', 4, 'E', 4),
      quizPitchSameDiffItem('G', 4, 'G', 4),
      quizPitchSameDiffItem('D', 4, 'A', 4),
      readingItem('แยกคอร์ดเมเจอร์/ไมเนอร์ด้วยหู', 'Hearing Major vs Minor Chords',
        [
          "จำได้จากบทคอร์ดเบื้องต้นไหม? คอร์ดเมเจอร์ฟังดู 'สดใส/มีความสุข' ส่วนคอร์ดไมเนอร์ฟังดู 'เศร้า/มืดหม่น' — ความแตกต่างนี้ได้ยินได้จริงๆ ไม่ใช่แค่ทฤษฎี",
          "ลองฟังคอร์ดในแบบฝึกหัดถัดไป แล้วถามตัวเองว่า 'ฟังดูมีความสุขไหม หรือฟังดูเหงาๆ' — ไม่ต้องรู้ชื่อโน้ตเป๊ะๆ ก็แยกได้ ใช้ความรู้สึกล้วนๆ",
          'ทักษะนี้ฝึกบ่อยๆ จะกลายเป็นสัญชาตญาณ — นักดนตรีมืออาชีพหลายคนแยกเมเจอร์/ไมเนอร์ได้ในเสี้ยววินาทีโดยไม่ต้องคิด'
        ],
        [
          "Remember from the Basic Chords lesson? Major chords sound 'bright/happy' while minor chords sound 'sad/dark' — this difference is genuinely audible, not just theory.",
          "Listen to the chord in the next exercises and ask yourself, 'does this sound happy, or does it sound melancholy?' — you don't need to know the exact notes, just go by feeling.",
          "Practice this often and it becomes instinct — many professional musicians can tell major from minor in a split second without even thinking about it."
        ]),
      quizChordEarItem(0), quizChordEarItem(1), quizChordEarItem(3), quizChordEarItem(5)
    ]
  },
  {
    id: 'ear-training-advanced',
    label: { th: 'ฝึกหูขั้นสูง', en: 'Advanced Ear Training' },
    group: { th: 'ฝึกหู', en: 'Ear Training' },
    items: [
      readingItem('ขั้นคู่เสียง (Interval) คืออะไร', 'What Is an Interval',
        [
          'ขั้นคู่เสียง (Interval) คือระยะห่างระหว่างโน้ต 2 ตัว — เป็นทักษะฝึกหูขั้นถัดไปหลังจากแยกเสียงสูง/ต่ำได้แล้ว เพราะช่วยให้บอกได้ว่าสองเสียงห่างกัน "เท่าไร" ไม่ใช่แค่ "ไปทางไหน"',
          "บทนี้ฝึก 4 ขั้นคู่เสียงพื้นฐานจากโน้ต C: คู่ 2 (C→D, ใกล้กันมาก ฟังคล้ายเสียงเลื่อน), คู่ 3 (C→E, ระยะห่างคอร์ด), คู่ 5 (C→G, ฟังกว้างและมั่นคง) และอ็อกเทฟ (C→C ตัวถัดไป, ฟังเหมือนเป็นโน้ตเดียวกันแต่สูง/ต่ำกว่า)",
          'เทคนิคช่วยจำ: ลองนึกถึงเพลงที่ขึ้นต้นด้วยขั้นคู่เสียงนั้นๆ เช่น อ็อกเทฟฟังคล้ายเสียง "โด...โด" ซ้ำกันแต่คนละช่วงเสียง'
        ],
        [
          'An interval is the distance between two notes — the next ear-training skill after telling higher/lower apart, because it tells you "how far", not just "which direction".',
          'This lesson practices 4 basic intervals starting from C: a 2nd (C→D, very close, sounds like a slide), a 3rd (C→E, chord-spacing distance), a 5th (C→G, sounds wide and stable), and an octave (C→the next C, sounds like the same note but higher/lower).',
          'Memory trick: think of a song that starts with that interval — an octave sounds like "do...do" repeated but in a different register.'
        ]),
      quizIntervalItem('D', 4, '2nd'), quizIntervalItem('E', 4, '3rd'),
      quizIntervalItem('G', 4, '5th'), quizIntervalItem('C', 5, 'octave'),
      quizIntervalItem('C', 5, 'octave'), quizIntervalItem('G', 4, '5th'),
      quizIntervalItem('E', 4, '3rd'), quizIntervalItem('D', 4, '2nd'),
      readingItem('ฝึกจับจังหวะ (Rhythm Dictation)', 'Rhythm Dictation',
        [
          'จับจังหวะ (Rhythm Dictation) คือการฟังแล้วแยกแยะรูปแบบจังหวะโดยไม่ต้องดูโน้ต — ใช้เสียงระดับเดียวกันซ้ำๆ เน้นที่ "ความยาว-สั้นของแต่ละเสียง" เท่านั้น',
          'แต่ละแพทเทิร์นในแบบฝึกหัดยาวเท่ากัน (4 จังหวะ) แต่แบ่งย่อยต่างกัน — ฟังให้ดีว่าตรงไหน "สั้น" (เสียงถี่ๆ) ตรงไหน "ยาว" (เสียงห่างๆ) แล้วเทียบกับตัวเลือก',
          'กดปุ่ม 🔊 ฟังซ้ำได้เรื่อยๆ ลองนับจังหวะเบาๆ ในใจไปด้วยจะช่วยแยกแยะได้ง่ายขึ้น'
        ],
        [
          "Rhythm dictation means listening and identifying a rhythmic pattern without looking at notation — using the same pitch repeated, focused purely on each note's short/long duration.",
          'Each pattern in the exercises is the same total length (4 beats) but subdivided differently — listen carefully for where it\'s "short" (quick notes) versus "long" (spaced-out notes), then compare to the options.',
          'Press 🔊 to listen as many times as you like — quietly counting the beat along in your head helps you tell them apart.'
        ]),
      quizRhythmItem('steady'), quizRhythmItem('shortShortLong'),
      quizRhythmItem('longShortShort'), quizRhythmItem('fourEighths'),
      quizRhythmItem('fourEighths'), quizRhythmItem('longShortShort'),
      quizRhythmItem('shortShortLong'), quizRhythmItem('steady')
    ]
  },
  {
    id: 'first-song',
    label: { th: 'เพลงแรกของคุณ', en: 'Your First Song' },
    group: { th: 'นำไปใช้จริง', en: 'Apply It' },
    items: [
      readingItem('จากทฤษฎีสู่เพลงจริง', 'From Theory to a Real Song',
        [
          'ตอนนี้คุณรู้จักบันไดเสียง C Major, คอร์ดไทรแอด, และโพรเกรสชัน I-V-vi-IV (C-G-Am-F) แล้ว — ถึงเวลาเอาทุกอย่างมารวมกันเป็นเพลงจริงสักเพลง!',
          "เพลงส่วนใหญ่ไม่ได้ใช้คอร์ดสุ่มๆ แต่ใช้ 'โพรเกรสชัน' (ลำดับคอร์ดที่วนซ้ำ) เป็นโครงหลัก แล้วใส่ทำนอง/เนื้อร้องทับลงไป — I-V-vi-IV ที่เรียนไปเป็นหนึ่งในโพรเกรสชันที่ใช้บ่อยที่สุดในโลก",
          'บทนี้จะให้เพลงฝึกหัดสั้นๆ (แต่งขึ้นมาเพื่อฝึกโดยเฉพาะ) ให้ลองเล่นตามคอร์ดจริง แล้วฝึกจำลำดับโพรเกรสชันให้ขึ้นใจ'
        ],
        [
          "By now you know the C Major scale, chord triads, and the I-V-vi-IV progression (C-G-Am-F) — time to put it all together into an actual song!",
          "Most songs don't use random chords — they use a 'progression' (a repeating chord sequence) as the backbone, then add melody/lyrics on top. I-V-vi-IV is one of the most-used progressions in the world.",
          "This lesson gives you a short practice song (written specifically for practice) to play along with real chords, then drills memorizing the progression order."
        ]),
      Object.assign(
        readingItem("เพลงฝึกหัด: 'เดินเล่นยามเย็น'", "Practice Song: 'Evening Walk'",
          [
            'ลองเล่นเพลงฝึกหัดนี้ตามคอร์ดที่กำหนด เล่นคอร์ดละ 1 ห้อง (4 จังหวะ ในจังหวะ 4/4) แล้วขึ้นคอร์ดถัดไปตามลำดับ',
            "ห้องที่ 1 (คอร์ด C): 'เดินเล่นยามเย็น' — ห้องที่ 2 (คอร์ด G): 'ลมพัดมาแผ่วเบา' — ห้องที่ 3 (คอร์ด Am): 'มองท้องฟ้าสีทอง' — ห้องที่ 4 (คอร์ด F): 'ใจฉันสงบเย็น' — แล้ววนกลับไปห้องที่ 1 ใหม่",
            'ใช้คอร์ดที่เรียนไปแล้วได้เลย ไม่ว่าจะเปียโน (root-3rd-5th เว้น 1 คีย์ขาว) หรือกีตาร์ (ไดอะแกรมคอร์ดเปิดจากบทที่แล้ว) — ลองเล่นช้าๆ ก่อน แล้วค่อยเพิ่มความเร็ว'
          ],
          [
            "Try playing this practice song with the given chords — play each chord for 1 measure (4 beats, in 4/4 time) then move to the next chord in order.",
            "Measure 1 (C chord): 'Walking in the evening' — Measure 2 (G chord): 'A gentle breeze drifts by' — Measure 3 (Am chord): 'Watching the golden sky' — Measure 4 (F chord): 'My heart feels calm and still' — then loop back to measure 1.",
            "Use the chords you already learned — on piano (root-3rd-5th skipping 1 white key) or guitar (open chord diagrams from the last lesson). Try it slowly first, then speed up."
          ]),
        { progression: true }
      ),
      quizProgressionItem(1), quizProgressionItem(2), quizProgressionItem(3), quizProgressionItem(4)
    ]
  },
  {
    id: 'beyond-c-major',
    label: { th: 'ขยายทฤษฎี: คีย์อื่นและคอร์ด 7th', en: 'Beyond C Major: Other Keys & 7th Chords' },
    group: { th: 'ทฤษฎีขั้นสูง', en: 'Advanced Theory' },
    items: [
      readingItem('ทำไมต้องมีคีย์อื่น', 'Why Other Keys Exist',
        [
          'บันไดเสียงเมเจอร์ทุกคีย์ต้องเรียงตามแพทเทิร์น W-W-H-W-W-W-H เสมอ — C Major ใช้แค่คีย์ขาวได้พอดีเพราะครึ่งเสียงธรรมชาติ (E-F, B-C) ตรงกับตำแหน่งในแพทเทิร์นพอดี',
          'แต่ถ้าเริ่มบันไดเสียงจากโน้ตอื่น (เช่น G หรือ F) ตำแหน่งครึ่งเสียงธรรมชาติจะไม่ตรงกับแพทเทิร์นอีกต่อไป จึงต้องปรับโน้ตบางตัวด้วยเครื่องหมาย # (ชาร์ป, สูงขึ้นครึ่งเสียง) หรือ ♭ (แฟลต, ต่ำลงครึ่งเสียง) เพื่อรักษาแพทเทิร์นไว้',
          "แต่ละคีย์เมเจอร์จึงมี 'เครื่องหมายกุญแจเสียง' (key signature) ของตัวเอง — จำนวน # หรือ ♭ ที่ต้องใช้คงที่ตลอดทั้งเพลง เขียนไว้ครั้งเดียวตรงต้นบรรทัดหลังกุญแจ"
        ],
        [
          "Every major scale must follow the W-W-H-W-W-W-H pattern exactly — C Major happens to use only white keys because its natural half steps (E-F, B-C) line up perfectly with the pattern's positions.",
          "But starting the scale from a different note (like G or F) means the natural half-step positions no longer line up with the pattern, so some notes must be adjusted with a # (sharp, raise by a half step) or ♭ (flat, lower by a half step) to preserve the pattern.",
          "Each major key therefore has its own 'key signature' — a fixed set of sharps or flats used throughout the whole piece, written once at the start of the staff right after the clef."
        ]),
      readingItem('บันไดเสียง G Major (1 ชาร์ป)', 'The G Major Scale (1 Sharp)',
        [
          'บันไดเสียง G Major: G-A-B-C-D-E-F#-G — เหมือน C Major ทุกอย่าง ยกเว้นโน้ตตัวที่ 7 ต้องเป็น F# (ไม่ใช่ F ธรรมดา) เพื่อให้ครึ่งเสียงสุดท้าย (ตัวที่ 7 ไป 8) ตรงตำแหน่ง',
          'ทำไมต้องเป็น F# ไม่ใช่ F: ไล่ตามแพทเทิร์น W-W-H-W-W-W-H จาก G จะได้ A(W) B(W) C(H) D(W) E(W) F#(W) G(H) — ถ้าใช้ F ธรรมดาแทน จะกลายเป็นครึ่งเสียงผิดตำแหน่ง',
          "เครื่องหมายกุญแจเสียงของ G Major คือ '1 ชาร์ป' (F#) เท่านั้น — คีย์เมเจอร์ที่มี # น้อยที่สุด (นอกจาก C Major ที่ไม่มีเลย)"
        ],
        [
          "The G Major scale: G-A-B-C-D-E-F#-G — identical to C Major except the 7th note must be F# (not plain F) to keep the final half step (7th to 8th) in the right place.",
          "Why F# and not F: following the W-W-H-W-W-W-H pattern from G gives A(W) B(W) C(H) D(W) E(W) F#(W) G(H) — using plain F instead would put the half step in the wrong spot.",
          "G Major's key signature is just '1 sharp' (F#) — the major key with the fewest sharps (besides C Major, which has none)."
        ]),
      readingItem('บันไดเสียง F Major (1 แฟลต)', 'The F Major Scale (1 Flat)',
        [
          'บันไดเสียง F Major: F-G-A-Bb-C-D-E-F — เหมือน C Major ทุกอย่าง ยกเว้นโน้ตตัวที่ 4 ต้องเป็น Bb (ไม่ใช่ B ธรรมดา)',
          'ทำไมต้องเป็น Bb ไม่ใช่ B: ไล่ตามแพทเทิร์นจาก F จะได้ G(W) A(W) Bb(H) C(W) D(W) E(W) F(H) — ถ้าใช้ B ธรรมดา ระยะจาก A ไป B จะกลายเป็นเต็มเสียง ทำให้ตำแหน่งที่ 3-4 ยาวเกินไป (ผิดแพทเทิร์น)',
          "เครื่องหมายกุญแจเสียงของ F Major คือ '1 แฟลต' (Bb) — คีย์เมเจอร์ที่มี ♭ น้อยที่สุด"
        ],
        [
          "The F Major scale: F-G-A-Bb-C-D-E-F — identical to C Major except the 4th note must be Bb (not plain B).",
          "Why Bb and not B: following the pattern from F gives G(W) A(W) Bb(H) C(W) D(W) E(W) F(H) — using plain B would make the A-to-B gap a whole step, making positions 3-4 too long (breaking the pattern).",
          "F Major's key signature is just '1 flat' (Bb) — the major key with the fewest flats."
        ]),
      readingItem('วงกลมคู่ห้า (Circle of Fifths)', 'The Circle of Fifths',
        [
          "วงกลมคู่ห้า (Circle of Fifths) คือแผนภาพวงกลมที่เรียงคีย์เมเจอร์ทั้ง 12 คีย์ตามจำนวน #/♭ — เริ่มจาก C Major (ไม่มี #/♭) ที่ 12 นาฬิกา วนตามเข็มนาฬิกาแต่ละคีย์เพิ่ม # อีก 1 ตัว (G=1#, D=2#, A=3# ...) วนทวนเข็มแต่ละคีย์เพิ่ม ♭ อีก 1 ตัว (F=1♭, Bb=2♭, Eb=3♭ ...)",
          "เหตุผลที่เรียกว่า 'คู่ห้า': แต่ละคีย์ถัดไปตามเข็มนาฬิกาห่างจากคีย์ก่อนหน้าเป็นระยะ 'คู่ห้าสมบูรณ์' (perfect 5th) พอดี เช่น C ไป G คือคู่ห้า, G ไป D คือคู่ห้า ต่อเนื่องกันไปเรื่อยๆ",
          'นักดนตรีใช้วงกลมนี้ช่วยจำเครื่องหมายกุญแจเสียงของทุกคีย์ได้เร็ว และช่วยแต่งเพลง/เปลี่ยนคีย์ (modulate) ได้ง่ายขึ้น เพราะคีย์ที่อยู่ใกล้กันบนวงกลมมักฟังเข้ากันได้ดี'
        ],
        [
          "The Circle of Fifths is a circular diagram arranging all 12 major keys by their number of sharps/flats — starting at C Major (no sharps/flats) at 12 o'clock, going clockwise each key adds one more sharp (G=1♯, D=2♯, A=3♯...), going counterclockwise each key adds one more flat (F=1♭, Bb=2♭, Eb=3♭...).",
          "Why 'fifths': each next key clockwise is exactly a 'perfect fifth' away from the previous one — e.g. C to G is a fifth, G to D is a fifth, and so on continuously.",
          "Musicians use this circle to quickly recall every key's signature, and it helps with composing/modulating (changing keys), since keys near each other on the circle tend to sound compatible."
        ]),
      readingItem('คอร์ด 7th คืออะไร', 'What Is a 7th Chord',
        [
          "คอร์ด 7th คือไทรแอด (root-3rd-5th) ที่เติมโน้ตตัวที่ 4 เข้าไปอีก 1 ตัว คือ '7th' (ซ้อนสามต่อจาก 5th อีกชั้น) ทำให้ได้เสียงที่ซับซ้อน/มีสีสันมากกว่าไทรแอดธรรมดา",
          "Dominant 7th (เขียนแค่ '7' เช่น G7): ไทรแอดเมเจอร์ + minor 7th — เสียงตึง อยากแก้ (resolve) ไปคอร์ดหลัก มักใช้เป็นคอร์ด V7 ก่อนจบท่อน",
          'Major 7th (Cmaj7): ไทรแอดเมเจอร์ + major 7th — เสียงนุ่ม ฟุ้งฝัน. Minor 7th (Am7): ไทรแอดไมเนอร์ + minor 7th — เสียงนุ่มแบบหม่นๆ พบบ่อยในแจ๊ส/R&B'
        ],
        [
          "A 7th chord is a triad (root-3rd-5th) with one more note stacked on top — the '7th' (another third above the 5th) — giving a richer, more colorful sound than a plain triad.",
          "Dominant 7th (written just '7', e.g. G7): a major triad + minor 7th — a tense sound that wants to resolve to the tonic chord, often used as the V7 chord right before ending a phrase.",
          "Major 7th (Cmaj7): a major triad + major 7th — soft, dreamy sound. Minor 7th (Am7): a minor triad + minor 7th — soft, mellow sound, common in jazz/R&B."
        ]),
      mcqItem(
        'คีย์ G Major มีเครื่องหมายกุญแจเสียงแบบไหน?', 'What is the key signature of G Major?',
        [mcqOpt('a', '1 ชาร์ป (F#)', '1 sharp (F#)'), mcqOpt('b', '1 แฟลต (Bb)', '1 flat (Bb)'),
         mcqOpt('c', '2 ชาร์ป', '2 sharps'), mcqOpt('d', 'ไม่มีเลย', 'None')],
        'a'
      ),
      mcqItem(
        'คีย์ F Major มีเครื่องหมายกุญแจเสียงแบบไหน?', 'What is the key signature of F Major?',
        [mcqOpt('a', '1 แฟลต (Bb)', '1 flat (Bb)'), mcqOpt('b', '1 ชาร์ป (F#)', '1 sharp (F#)'),
         mcqOpt('c', '2 แฟลต', '2 flats'), mcqOpt('d', 'ไม่มีเลย', 'None')],
        'a'
      ),
      mcqItem(
        'โน้ตตัวที่ 7 ของบันไดเสียง G Major คือตัวอะไร?', 'What is the 7th note of the G Major scale?',
        [mcqOpt('a', 'F#', 'F#'), mcqOpt('b', 'F', 'F'), mcqOpt('c', 'G', 'G'), mcqOpt('d', 'E', 'E')],
        'a'
      ),
      mcqItem(
        'โน้ตตัวที่ 4 ของบันไดเสียง F Major คือตัวอะไร?', 'What is the 4th note of the F Major scale?',
        [mcqOpt('a', 'Bb', 'Bb'), mcqOpt('b', 'B', 'B'), mcqOpt('c', 'A', 'A'), mcqOpt('d', 'C', 'C')],
        'a'
      ),
      mcqItem(
        'บนวงกลมคู่ห้า เคลื่อนตามเข็มนาฬิกาจาก C ไป 1 ขั้น จะถึงคีย์ไหน?', 'On the Circle of Fifths, moving 1 step clockwise from C reaches which key?',
        [mcqOpt('a', 'G', 'G'), mcqOpt('b', 'F', 'F'), mcqOpt('c', 'D', 'D'), mcqOpt('d', 'A', 'A')],
        'a'
      ),
      mcqItem(
        'บนวงกลมคู่ห้า เคลื่อนทวนเข็มนาฬิกาจาก C ไป 1 ขั้น จะถึงคีย์ไหน?', 'On the Circle of Fifths, moving 1 step counterclockwise from C reaches which key?',
        [mcqOpt('a', 'F', 'F'), mcqOpt('b', 'G', 'G'), mcqOpt('c', 'Bb', 'Bb'), mcqOpt('d', 'D', 'D')],
        'a'
      ),
      mcqItem(
        'คอร์ด G7 (Dominant 7th) ประกอบด้วยไทรแอดแบบไหน + โน้ตอะไรเพิ่ม?', 'A G7 (Dominant 7th) chord is built from which triad + what added note?',
        [mcqOpt('a', 'ไทรแอดเมเจอร์ + minor 7th', 'Major triad + minor 7th'),
         mcqOpt('b', 'ไทรแอดไมเนอร์ + major 7th', 'Minor triad + major 7th'),
         mcqOpt('c', 'ไทรแอดเมเจอร์ + major 7th', 'Major triad + major 7th'),
         mcqOpt('d', 'ไทรแอดดิมินิชด์ + minor 7th', 'Diminished triad + minor 7th')],
        'a'
      ),
      mcqItem(
        'คอร์ด Dominant 7th (เช่น G7) มักใช้ทำหน้าที่อะไรในเพลง?', 'What role does a Dominant 7th chord (e.g. G7) usually play in a song?',
        [mcqOpt('a', 'สร้างความตึงก่อนแก้กลับไปคอร์ดหลัก (V7→I)', 'Creates tension before resolving to the tonic chord (V7→I)'),
         mcqOpt('b', 'เป็นคอร์ดเปิดเพลงเสมอ', 'Always the opening chord of a song'),
         mcqOpt('c', 'ใช้แทนคอร์ด IV เท่านั้น', 'Only used to substitute for the IV chord'),
         mcqOpt('d', 'ไม่มีหน้าที่พิเศษ', 'Has no special function')],
        'a'
      )
    ]
  }
];

function trackById(id) { for (var i = 0; i < TRACKS.length; i++) if (TRACKS[i].id === id) return TRACKS[i]; return TRACKS[0]; }
function progressKey(trackId, itemIndex) { return trackId + '::' + itemIndex; }
function loadProgress() { try { return JSON.parse(localStorage.getItem('tanot:music:progress')) || {}; } catch (e) { return {}; } }
function saveProgress(p) { try { localStorage.setItem('tanot:music:progress', JSON.stringify(p)); } catch (e) {} }
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
   Gamification — เลเวล/XP/สตรีค/เหรียญตรา (ก็อปจาก coding.js ให้ประสบการณ์เหมือนกันทั้งเว็บ)
   ══════════════════════════════════════════════════════════════════ */
var XP_KEY = 'tanot:music:xp';
var STREAK_KEY = 'tanot:music:streak';
var BADGES_KEY = 'tanot:music:badges';
var XP_PER_EXERCISE = 20;
var XP_PER_TRACK_BONUS = 50;
var XP_PER_LEVEL = 50;

function loadXp() { try { return parseInt(localStorage.getItem(XP_KEY), 10) || 0; } catch (e) { return 0; } }
function saveXp(xp) { try { localStorage.setItem(XP_KEY, String(xp)); } catch (e) {} }
function levelFromXp(xp) { return 1 + Math.floor(xp / XP_PER_LEVEL); }
function xpIntoLevel(xp) { return xp % XP_PER_LEVEL; }
function levelTitle(level) {
  var th = ['นักดนตรีมือใหม่', 'นักเรียนดนตรี', 'นักดนตรีฝึกหัด', 'นักดนตรีรุ่นเยาว์', 'นักดนตรีมือโปร', 'เซียนดนตรี'];
  var en = ['Music Newbie', 'Music Student', 'Junior Musician', 'Rising Musician', 'Pro Musician', 'Music Master'];
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
  { id: 'track-staff-clef', icon: '🎼', th: 'รู้จักบรรทัดเพลง', en: 'Staff Reader' },
  { id: 'track-note-reading-treble', icon: '🎵', th: 'เจ้าแห่งโน้ตซอล', en: 'Treble Note Master' },
  { id: 'track-bass-clef', icon: '𝄢', th: 'เจ้าแห่งโน้ตฟา', en: 'Bass Note Master' },
  { id: 'track-note-values', icon: '⏱️', th: 'เจ้าจังหวะ', en: 'Rhythm Master' },
  { id: 'track-time-signatures', icon: '🥁', th: 'เจ้าเครื่องหมายจังหวะ', en: 'Time Signature Master' },
  { id: 'track-scales', icon: '🪜', th: 'เจ้าบันไดเสียง', en: 'Scale Master' },
  { id: 'track-chords', icon: '🎶', th: 'เจ้าคอร์ด', en: 'Chord Master' },
  { id: 'track-piano', icon: '🎹', th: 'เจ้าเปียโน', en: 'Piano Master' },
  { id: 'track-guitar', icon: '🎸', th: 'เจ้ากีตาร์', en: 'Guitar Master' },
  { id: 'track-ukulele', icon: '🪕', th: 'เจ้าอูคูเลเล่', en: 'Ukulele Master' },
  { id: 'track-drums', icon: '🪘', th: 'เจ้ากลอง', en: 'Drum Master' },
  { id: 'track-violin', icon: '🎻', th: 'เจ้าไวโอลิน', en: 'Violin Master' },
  { id: 'track-ear-training', icon: '👂', th: 'นักฟังเสียง', en: 'Ear Training Master' },
  { id: 'track-ear-training-advanced', icon: '🎧', th: 'เจ้าหูทอง', en: 'Golden Ear' },
  { id: 'track-first-song', icon: '🎤', th: 'เพลงแรกของฉัน', en: 'First Song Complete' },
  { id: 'track-beyond-c-major', icon: '🗝️', th: 'เจ้ากุญแจเสียง', en: 'Key Signature Master' },
  { id: 'streak-3', icon: '🔥', th: 'ขยัน 3 วันติด', en: '3-Day Streak' },
  { id: 'streak-7', icon: '🔥', th: 'สัปดาห์นักสู้', en: '7-Day Streak' },
  { id: 'all-tracks', icon: '🏆', th: 'จบคอร์สทฤษฎีเบื้องต้น!', en: 'Theory Basics Complete!' }
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
if (typeof document !== 'undefined' && document.getElementById('musicRoot')) {
  var $ = function (id) { return document.getElementById(id); };
  var trackMenuBtn = $('trackMenuBtn'), trackMenuPanel = $('trackMenuPanel'), currentTrackLabel = $('currentTrackLabel'),
      itemList = $('itemList'), lockMsg = $('lockMsg'), instructionsBox = $('instructionsBox'),
      itemHeading = $('itemHeading'), langToggle = $('langToggle'),
      staffWrap = $('staffWrap'), quizPromptEl = $('quizPrompt'), staffSvgHolder = $('staffSvgHolder'),
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
        b.className = 'mx-badge' + (earned.indexOf(def.id) !== -1 ? ' earned' : '');
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
    el.className = 'mx-toast';
    el.textContent = item.icon + ' ' + item.text;
    if (toastWrap) toastWrap.appendChild(el);
    setTimeout(function () {
      el.classList.add('leaving');
      setTimeout(function () { el.remove(); processToastQueue(); }, 300);
    }, 2200);
  }

  var CONFETTI_COLORS = ['#7C3AED', '#DB2777', '#17B76A', '#F5A524', '#3B9BEA'];
  function spawnConfetti() {
    if (!confettiLayer) return;
    confettiLayer.innerHTML = '';
    for (var i = 0; i < 18; i++) {
      var piece = document.createElement('span');
      piece.className = 'mx-confetti-piece';
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
        groupEl.className = 'mx-track-group-label';
        groupEl.textContent = groupText;
        trackMenuPanel.appendChild(groupEl);
        lastGroup = groupText;
      }
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mx-track-menu-item' + (tr.id === state.trackId ? ' active' : '');
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
    return (getUILang() === 'en' ? 'Practice ' : 'แบบฝึกหัดที่ ') + quizNum;
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
      btn.className = 'mx-item' + (i === state.itemIndex ? ' active' : '') + (unlocked ? '' : ' locked');
      btn.textContent = (passed ? '✅ ' : unlocked ? (item.kind === 'reading' ? '📖 ' : '🎵 ') : '🔒 ') + itemLabel(track, item, i);
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
    resultBanner.className = 'mx-result-banner';

    if (item.kind === 'reading') {
      itemHeading.textContent = pick(item.heading);
      instructionsBox.innerHTML = pick(item.body).map(function (p) { return '<p>' + p + '</p>'; }).join('');
      if (item.progression) {
        instructionsBox.innerHTML += buildProgressionListenHtml();
        var progBtn = document.getElementById('progPlayBtn');
        if (progBtn) progBtn.addEventListener('click', function () { playProgression(progressionFreqs()); });
      }
      if (item.drumBeat) {
        instructionsBox.innerHTML += buildDrumBeatListenHtml();
        var beatBtn = document.getElementById('drumBeatPlayBtn');
        if (beatBtn) beatBtn.addEventListener('click', function () { playRockBeat(); });
      }
      staffWrap.style.display = 'none';
      markReadBtn.style.display = 'inline-flex';
      markReadBtn.disabled = false;
    } else {
      itemHeading.textContent = itemLabel(track, item, idx);
      instructionsBox.innerHTML = '';
      staffWrap.style.display = 'block';
      markReadBtn.style.display = 'none';
      if (item.qType === 'note-value') {
        quizPromptEl.textContent = t('quizPromptValue');
        staffSvgHolder.innerHTML = buildNoteValueSvg(item.duration);
      } else if (item.qType === 'time-sig-beats') {
        quizPromptEl.textContent = t('quizPromptTimeSigBeats');
        staffSvgHolder.innerHTML = buildTimeSigSvg(item.top, item.bottom);
      } else if (item.qType === 'time-sig-unit') {
        quizPromptEl.textContent = t('quizPromptTimeSigUnit');
        staffSvgHolder.innerHTML = buildTimeSigSvg(item.top, item.bottom);
      } else if (item.qType === 'scale-degree') {
        quizPromptEl.textContent = t('quizPromptScaleDegree', { degree: item.degree });
        staffSvgHolder.innerHTML = buildScaleDisplayHtml(item.degree);
      } else if (item.qType === 'chord-quality') {
        quizPromptEl.textContent = t('quizPromptChordQuality');
        staffSvgHolder.innerHTML = buildChordStaffSvg(item.steps);
      } else if (item.qType === 'chord-root') {
        quizPromptEl.textContent = t('quizPromptChordRoot');
        staffSvgHolder.innerHTML = buildChordStaffSvg(item.steps);
      } else if (item.qType === 'piano-note') {
        quizPromptEl.textContent = t('quizPromptPianoNote');
        staffSvgHolder.innerHTML = buildPianoSvg([item.slot]);
      } else if (item.qType === 'piano-chord-quality') {
        quizPromptEl.textContent = t('quizPromptPianoChordQuality');
        staffSvgHolder.innerHTML = buildPianoSvg(item.slots);
      } else if (item.qType === 'piano-chord-root') {
        quizPromptEl.textContent = t('quizPromptPianoChordRoot');
        staffSvgHolder.innerHTML = buildPianoSvg(item.slots);
      } else if (item.qType === 'guitar-chord') {
        quizPromptEl.textContent = t('quizPromptGuitarChord');
        staffSvgHolder.innerHTML = buildGuitarChordSvg(item.pattern);
      } else if (item.qType === 'ukulele-chord') {
        quizPromptEl.textContent = t('quizPromptUkuleleChord');
        staffSvgHolder.innerHTML = buildUkuleleChordSvg(item.pattern);
      } else if (item.qType === 'pitch-compare' || item.qType === 'pitch-same-diff' || item.qType === 'chord-quality-ear') {
        quizPromptEl.textContent = t(
          item.qType === 'pitch-compare' ? 'quizPromptPitchCompare' :
          item.qType === 'pitch-same-diff' ? 'quizPromptPitchSameDiff' : 'quizPromptChordEar'
        );
        staffSvgHolder.innerHTML = buildEarPlayerHtml();
        var playFn = item.qType === 'chord-quality-ear'
          ? function () { playChordTones(item.freqs); }
          : function () { playSequence(item.freqs); };
        var earBtn = document.getElementById('earPlayBtn');
        if (earBtn) earBtn.addEventListener('click', playFn);
      } else if (item.qType === 'drum-ear') {
        quizPromptEl.textContent = t('quizPromptDrumEar');
        staffSvgHolder.innerHTML = buildEarPlayerHtml();
        var drBtn = document.getElementById('earPlayBtn');
        if (drBtn) drBtn.addEventListener('click', function () { playDrumHit(item.drumType); });
      } else if (item.qType === 'violin-string-ear') {
        quizPromptEl.textContent = t('quizPromptViolinString');
        staffSvgHolder.innerHTML = buildEarPlayerHtml();
        var vsBtn = document.getElementById('earPlayBtn');
        if (vsBtn) vsBtn.addEventListener('click', function () { playSequence([item.freq]); });
      } else if (item.qType === 'interval-ear') {
        quizPromptEl.textContent = t('quizPromptInterval');
        staffSvgHolder.innerHTML = buildEarPlayerHtml();
        var ivBtn = document.getElementById('earPlayBtn');
        if (ivBtn) ivBtn.addEventListener('click', function () { playSequence(item.freqs); });
      } else if (item.qType === 'rhythm-dictation') {
        quizPromptEl.textContent = t('quizPromptRhythm');
        staffSvgHolder.innerHTML = buildEarPlayerHtml();
        var rhBtn = document.getElementById('earPlayBtn');
        if (rhBtn) rhBtn.addEventListener('click', function () { playRhythm(item.durations); });
      } else if (item.qType === 'progression-position') {
        quizPromptEl.textContent = t('quizPromptProgression', { position: item.position });
        staffSvgHolder.innerHTML = buildProgressionDisplayHtml(item.position);
        var pgBtn = document.getElementById('progPlayBtn');
        if (pgBtn) pgBtn.addEventListener('click', function () { playProgression(progressionFreqs()); });
      } else if (item.qType === 'mcq') {
        quizPromptEl.textContent = pick(item.prompt);
        staffSvgHolder.innerHTML = '';
      } else {
        quizPromptEl.textContent = t(CLEFS[item.clef || 'treble'].promptKey);
        staffSvgHolder.innerHTML = buildStaffSvg(item.step, item.clef);
      }
      renderAnswerRow(item);
    }

    var progress = loadProgress();
    var trackIdx = TRACKS.indexOf(track);
    var isLastOfTrack = idx === track.items.length - 1;
    var alreadyPassed = !!progress[progressKey(track.id, idx)];
    if (alreadyPassed && isLastOfTrack && trackCompleted(track, progress)) {
      resultBanner.textContent = t('trackDoneMsg');
      resultBanner.className = 'mx-result-banner pass';
      resultBanner.style.display = 'block';
    }
  }

  var ANSWER_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  var TIME_SIG_BEATS_OPTIONS = [2, 3, 4, 6];
  var CHORD_QUALITY_OPTIONS = ['major', 'minor'];
  var CHORD_QUALITY_LABELS = {
    major: { th: 'เมเจอร์ (Major)', en: 'Major' },
    minor: { th: 'ไมเนอร์ (Minor)', en: 'Minor' }
  };
  var PITCH_COMPARE_OPTIONS = ['higher', 'lower'];
  var PITCH_COMPARE_LABELS = {
    higher: { th: 'สูงกว่า', en: 'Higher' },
    lower: { th: 'ต่ำกว่า', en: 'Lower' }
  };
  var PITCH_SAME_DIFF_OPTIONS = ['same', 'different'];
  var PITCH_SAME_DIFF_LABELS = {
    same: { th: 'เสียงเดียวกัน', en: 'Same' },
    different: { th: 'ต่างกัน', en: 'Different' }
  };
  var INTERVAL_OPTIONS = ['2nd', '3rd', '5th', 'octave'];
  var INTERVAL_LABELS = {
    '2nd': { th: 'คู่ 2 (2nd)', en: '2nd' },
    '3rd': { th: 'คู่ 3 (3rd)', en: '3rd' },
    '5th': { th: 'คู่ 5 (5th)', en: '5th' },
    octave: { th: 'อ็อกเทฟ (Octave)', en: 'Octave' }
  };
  function renderAnswerRow(item) {
    answerRow.innerHTML = '';
    var progress = loadProgress();
    var track = trackById(state.trackId);
    var idx = state.itemIndex;
    var alreadyPassed = !!progress[progressKey(track.id, idx)];
    if (item.qType === 'mcq') {
      /* ตัวเลือก/ป้ายผูกกับ item เอง ไม่ใช่ชุดคงที่ทั้งแอปแบบ qType อื่น เลยแยก render ต่างหาก */
      item.options.forEach(function (opt) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mx-answer-btn wide';
        btn.textContent = pick(opt.label);
        if (alreadyPassed) {
          btn.disabled = true;
          if (opt.key === item.answer) btn.classList.add('correct');
        }
        btn.addEventListener('click', function () { handleAnswer(item, opt.key, btn); });
        answerRow.appendChild(btn);
      });
      return;
    }
    var isValueQuiz = item.qType === 'note-value' || item.qType === 'time-sig-unit';
    var isBeatsQuiz = item.qType === 'time-sig-beats';
    var isQualityQuiz = item.qType === 'chord-quality' || item.qType === 'piano-chord-quality' || item.qType === 'chord-quality-ear';
    var isGuitarQuiz = item.qType === 'guitar-chord';
    var isUkuleleQuiz = item.qType === 'ukulele-chord';
    var isPitchCompareQuiz = item.qType === 'pitch-compare';
    var isPitchSameDiffQuiz = item.qType === 'pitch-same-diff';
    var isProgressionQuiz = item.qType === 'progression-position';
    var isIntervalQuiz = item.qType === 'interval-ear';
    var isRhythmQuiz = item.qType === 'rhythm-dictation';
    var isDrumEarQuiz = item.qType === 'drum-ear';
    var isViolinStringQuiz = item.qType === 'violin-string-ear';
    var isWide = isValueQuiz || isQualityQuiz || isGuitarQuiz || isUkuleleQuiz || isPitchCompareQuiz || isPitchSameDiffQuiz || isProgressionQuiz || isIntervalQuiz || isRhythmQuiz || isDrumEarQuiz || isViolinStringQuiz;
    var choices = isValueQuiz ? NOTE_VALUE_ORDER : isBeatsQuiz ? TIME_SIG_BEATS_OPTIONS :
      isQualityQuiz ? CHORD_QUALITY_OPTIONS : isGuitarQuiz ? GUITAR_CHORD_NAMES :
      isUkuleleQuiz ? UKULELE_CHORD_NAMES :
      isPitchCompareQuiz ? PITCH_COMPARE_OPTIONS : isPitchSameDiffQuiz ? PITCH_SAME_DIFF_OPTIONS :
      isProgressionQuiz ? PROGRESSION_QUIZ_OPTIONS :
      isIntervalQuiz ? INTERVAL_OPTIONS : isRhythmQuiz ? RHYTHM_PATTERN_KEYS :
      isDrumEarQuiz ? DRUM_HIT_OPTIONS : isViolinStringQuiz ? VIOLIN_STRING_OPTIONS : ANSWER_LETTERS;
    choices.forEach(function (choice) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mx-answer-btn' + (isWide ? ' wide' : '');
      btn.textContent = isValueQuiz ? pick(NOTE_VALUE_LABELS[choice]) : isQualityQuiz ? pick(CHORD_QUALITY_LABELS[choice]) :
        isGuitarQuiz ? pick(GUITAR_CHORD_LABELS[choice]) : isUkuleleQuiz ? pick(UKULELE_CHORD_LABELS[choice]) :
        isPitchCompareQuiz ? pick(PITCH_COMPARE_LABELS[choice]) :
        isPitchSameDiffQuiz ? pick(PITCH_SAME_DIFF_LABELS[choice]) :
        isIntervalQuiz ? pick(INTERVAL_LABELS[choice]) : isRhythmQuiz ? pick(RHYTHM_PATTERN_LABELS[choice]) :
        isDrumEarQuiz ? pick(DRUM_HIT_LABELS[choice]) : isViolinStringQuiz ? pick(VIOLIN_STRING_LABELS[choice]) :
        isProgressionQuiz ? pick(PROGRESSION_LABELS[choice]) : String(choice);
      if (alreadyPassed) {
        btn.disabled = true;
        if (choice === item.answer) btn.classList.add('correct');
      }
      btn.addEventListener('click', function () { handleAnswer(item, choice, btn); });
      answerRow.appendChild(btn);
    });
  }

  function handleAnswer(item, choice, btnEl) {
    if (choice === item.answer) {
      Array.prototype.forEach.call(answerRow.children, function (b) { b.disabled = true; });
      btnEl.classList.add('correct');
      resultBanner.textContent = t('correctMsg');
      resultBanner.className = 'mx-result-banner pass';
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
        resultBanner.className = 'mx-result-banner pass';
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
