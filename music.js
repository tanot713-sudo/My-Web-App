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
  { id: 'track-bass-clef', icon: '🎻', th: 'เจ้าแห่งโน้ตฟา', en: 'Bass Note Master' },
  { id: 'track-note-values', icon: '⏱️', th: 'เจ้าจังหวะ', en: 'Rhythm Master' },
  { id: 'track-time-signatures', icon: '🥁', th: 'เจ้าเครื่องหมายจังหวะ', en: 'Time Signature Master' },
  { id: 'track-scales', icon: '🪜', th: 'เจ้าบันไดเสียง', en: 'Scale Master' },
  { id: 'track-chords', icon: '🎶', th: 'เจ้าคอร์ด', en: 'Chord Master' },
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
  function renderAnswerRow(item) {
    answerRow.innerHTML = '';
    var progress = loadProgress();
    var track = trackById(state.trackId);
    var idx = state.itemIndex;
    var alreadyPassed = !!progress[progressKey(track.id, idx)];
    var isValueQuiz = item.qType === 'note-value' || item.qType === 'time-sig-unit';
    var isBeatsQuiz = item.qType === 'time-sig-beats';
    var isQualityQuiz = item.qType === 'chord-quality';
    var isWide = isValueQuiz || isQualityQuiz;
    var choices = isValueQuiz ? NOTE_VALUE_ORDER : isBeatsQuiz ? TIME_SIG_BEATS_OPTIONS :
      isQualityQuiz ? CHORD_QUALITY_OPTIONS : ANSWER_LETTERS;
    choices.forEach(function (choice) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mx-answer-btn' + (isWide ? ' wide' : '');
      btn.textContent = isValueQuiz ? pick(NOTE_VALUE_LABELS[choice]) : isQualityQuiz ? pick(CHORD_QUALITY_LABELS[choice]) : String(choice);
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
