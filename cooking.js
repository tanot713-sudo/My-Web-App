/* ══════════════════════════════════════════════════════════════════
   Tanot — เรียนทำอาหาร (cooking.js)
   สถาปัตยกรรมก็อป-แล้วปรับจาก sports.js (แถบเกม/เมนูแฮมเบอร์เกอร์/sidebar ล็อกลำดับ/i18n TH-EN/
   ไดอะแกรม SVG) ต่างจาก sports.js ตรงมีเครื่องมือเสริมเฉพาะทาง: ตัวจับเวลา, อ่านออกเสียง (TTS),
   ตัวแปลงหน่วยตวง, โหมดดูทีละขั้นตอน, บันทึกส่วนตัวต่อบทเรียน — รายละเอียดแต่ละอย่างอยู่ท้ายไฟล์
   Stage 1: เฉพาะแทร็ก "พื้นฐานการทำครัว" — สูตรอาหารแยกตามประเทศเป็น Stage ถัดไป (ยังไม่ทำ)
   ══════════════════════════════════════════════════════════════════ */
'use strict';

/* ══════════════════════════════════════════════════════════════════
   i18n
   ══════════════════════════════════════════════════════════════════ */
var UI_LANG_KEY = 'tanot:cookinglang';
function getUILang() { try { return localStorage.getItem(UI_LANG_KEY) === 'en' ? 'en' : 'th'; } catch (e) { return 'th'; } }
function setUILang(l) { try { localStorage.setItem(UI_LANG_KEY, l); } catch (e) {} }
function pick(obj) { return obj ? (getUILang() === 'en' ? obj.en : obj.th) : ''; }

var I18N = {
  th: {
    pageTitle: 'เรียนทำอาหาร', crumbResp: 'งานที่รับผิดชอบ', crumbCooking: 'เรียนทำอาหาร',
    markReadBtn: '✓ เข้าใจแล้ว ไปต่อ',
    lockedMsg: 'บทเรียนนี้ยังล็อกอยู่ — ทำข้อก่อนหน้าให้ผ่านก่อน',
    trackDoneMsg: '🎉 จบบทเรียนนี้แล้ว! เลือกบทเรียนถัดไปจากเมนู ☰ ด้านบนได้เลย',
    toastTrackDone: 'จบบทเรียน "{track}" แล้ว! 🎉',
    toastBadge: 'ได้รับเหรียญตรา: "{badge}"!',
    toastLevelUp: 'เลเวลอัป! เลเวล {level} — {title}',
    speakBtn: '🔊 อ่านออกเสียง', speakingBtn: '🔊 กำลังอ่าน…',
    stepModeOn: '📋 ดูทีละขั้นตอน', stepModeOff: '📄 ดูทั้งหมด',
    stepPrev: '← ก่อนหน้า', stepNext: 'ถัดไป →', stepOf: 'ขั้นที่ {n} / {total}',
    notesLabel: '📝 บันทึกของฉัน (เห็นเฉพาะคุณ)', notesPlaceholder: 'จดโน้ตส่วนตัวเกี่ยวกับบทเรียนนี้ได้ที่นี่…', notesSaved: 'บันทึกแล้ว ✓',
    convBtn: '🧮 แปลงหน่วยตวง', convTitle: 'ตัวแปลงหน่วยตวง',
    convVolume: 'ปริมาตร', convWeight: 'น้ำหนัก (โดยประมาณ — ขึ้นกับความหนาแน่นของวัตถุดิบจริง)', convTemp: 'อุณหภูมิ',
    timerStart: '▶ เริ่ม', timerPause: '⏸ พัก', timerReset: '↺ รีเซ็ต', timerDone: '⏰ หมดเวลา!'
  },
  en: {
    pageTitle: 'Learn Cooking', crumbResp: 'Responsibilities', crumbCooking: 'Learn Cooking',
    markReadBtn: '✓ Got it, continue',
    lockedMsg: 'This lesson is locked — pass the previous one first.',
    trackDoneMsg: '🎉 Lesson complete! Pick the next lesson from the ☰ menu above.',
    toastTrackDone: 'Lesson "{track}" complete! 🎉',
    toastBadge: 'Badge earned: "{badge}"!',
    toastLevelUp: 'Level up! Level {level} — {title}',
    speakBtn: '🔊 Read aloud', speakingBtn: '🔊 Reading…',
    stepModeOn: '📋 Step-by-step', stepModeOff: '📄 View all',
    stepPrev: '← Back', stepNext: 'Next →', stepOf: 'Step {n} / {total}',
    notesLabel: '📝 My notes (private to you)', notesPlaceholder: 'Jot down personal notes about this lesson here…', notesSaved: 'Saved ✓',
    convBtn: '🧮 Unit converter', convTitle: 'Unit Converter',
    convVolume: 'Volume', convWeight: 'Weight (approximate — depends on the actual ingredient\'s density)', convTemp: 'Temperature',
    timerStart: '▶ Start', timerPause: '⏸ Pause', timerReset: '↺ Reset', timerDone: '⏰ Time\'s up!'
  }
};
function t(key, vars) {
  var l = getUILang();
  var s = (I18N[l] && I18N[l][key] !== undefined) ? I18N[l][key] : (I18N.th[key] !== undefined ? I18N.th[key] : key);
  if (vars) Object.keys(vars).forEach(function (k) { s = s.replace('{' + k + '}', vars[k]); });
  return s;
}

/* ══════════════════════════════════════════════════════════════════
   เนื้อหาบทเรียน — ทุกข้อเป็น 'reading' (อ่านอย่างเดียว ไม่มีข้อสอบ) เหมือน sports.js
   ══════════════════════════════════════════════════════════════════ */
function readingItem(headingTh, headingEn, paragraphsTh, paragraphsEn, diagramHtml) {
  return { kind: 'reading', heading: { th: headingTh, en: headingEn }, body: { th: paragraphsTh, en: paragraphsEn }, diagram: diagramHtml };
}

/* ══════════════════════════════════════════════════════════════════
   ไดอะแกรมประกอบบทเรียน — SVG วาดเองล้วน (ไม่ใช้ไฟล์ภาพ) ตามแนวทางเดียวกับ sports.js
   ══════════════════════════════════════════════════════════════════ */
function svgArrow(x1, y1, x2, y2, color) {
  var angle = Math.atan2(y2 - y1, x2 - x1);
  var headLen = 10;
  var hx1 = x2 - headLen * Math.cos(angle - Math.PI / 6);
  var hy1 = y2 - headLen * Math.sin(angle - Math.PI / 6);
  var hx2 = x2 - headLen * Math.cos(angle + Math.PI / 6);
  var hy2 = y2 - headLen * Math.sin(angle + Math.PI / 6);
  return '<line class="ck-arrow-line" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + color + '" stroke-width="3"/>' +
    '<polygon class="ck-arrow-head" points="' + x2 + ',' + y2 + ' ' + hx1 + ',' + hy1 + ' ' + hx2 + ',' + hy2 + '" fill="' + color + '"/>';
}
function svgWrap(inner, viewW, viewH, maxW, label) {
  return '<div style="text-align:center;margin:16px 0">' +
    '<svg viewBox="0 0 ' + viewW + ' ' + viewH + '" style="width:100%;max-width:' + maxW + 'px;height:auto;display:block;margin:0 auto" role="img" aria-label="' + label + '">' +
    inner + '</svg></div>';
}
function svgFactStrip(facts, label) {
  var badgeW = 128, gap = 12, h = 68;
  var n = facts.length;
  var viewW = n * badgeW + (n - 1) * gap + 20;
  var inner = facts.map(function (f, i) {
    var x = 10 + i * (badgeW + gap);
    return '<rect x="' + x + '" y="10" width="' + badgeW + '" height="' + h + '" rx="14" fill="' + f.color + '" opacity="0.14" stroke="' + f.color + '" stroke-width="2"/>' +
      '<text x="' + (x + badgeW / 2) + '" y="40" font-size="13" font-weight="800" text-anchor="middle" fill="' + f.color + '">' + f.title + '</text>' +
      '<text x="' + (x + badgeW / 2) + '" y="60" font-size="10.5" font-weight="600" text-anchor="middle" fill="' + f.color + '">' + f.sub + '</text>';
  }).join('');
  return svgWrap(inner, viewW, 88, Math.min(viewW, 580), label);
}
function svgFlowSteps(steps, label) {
  var boxW = 104, boxH = 56, gap = 36, y = 30;
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
  return svgWrap(parts.join(''), viewW, y + boxH + 32, Math.min(viewW, 580), label);
}
/* แถบอุณหภูมิแนวนอน พร้อมป้ายกำกับจุดสำคัญ — ใช้กับโซนอันตราย/เทคนิคทำอาหารแบบเปียก */
function svgTempBar(minT, maxT, marks, label) {
  var barX = 20, barY = 60, barW = 460, barH = 26;
  function xOf(temp) { return barX + ((temp - minT) / (maxT - minT)) * barW; }
  var segs = marks.map(function (m, i) {
    var x1 = xOf(m.from), x2 = xOf(m.to);
    return '<rect x="' + x1 + '" y="' + barY + '" width="' + (x2 - x1) + '" height="' + barH + '" fill="' + m.color + '" opacity="0.85"/>';
  }).join('');
  var labels = marks.map(function (m) {
    var xm = (xOf(m.from) + xOf(m.to)) / 2;
    return '<text x="' + xm + '" y="' + (barY + barH + 20) + '" font-size="11" font-weight="800" text-anchor="middle" fill="' + m.color + '">' + m.label + '</text>' +
      '<text x="' + xm + '" y="' + (barY + barH / 2 + 5) + '" font-size="10.5" font-weight="700" text-anchor="middle" fill="#FFFFFF">' + m.temp + '</text>';
  }).join('');
  var axis = '<line x1="' + barX + '" y1="' + (barY - 6) + '" x2="' + (barX + barW) + '" y2="' + (barY - 6) + '" stroke="#94A3B8" stroke-width="1.5"/>' +
    '<text x="' + barX + '" y="' + (barY - 12) + '" font-size="10" fill="#727C93" text-anchor="start">' + minT + '°C</text>' +
    '<text x="' + (barX + barW) + '" y="' + (barY - 12) + '" font-size="10" fill="#727C93" text-anchor="end">' + maxT + '°C</text>';
  return svgWrap(axis + '<rect x="' + barX + '" y="' + barY + '" width="' + barW + '" height="' + barH + '" rx="4" fill="none" stroke="#1F2430" stroke-width="1.5"/>' + segs + labels, 500, 120, 540, label);
}
/* ตำแหน่งจับมีดแบบ pinch grip + ตำแหน่งมือประคอง (claw grip) — แบบแผนผัง (schematic) ล้วนๆ
   ใช้วงกลมประ+ลูกศร+ป้ายชี้ตำแหน่งบนมีด/เขียง แทนการวาดรูปมือจริง เพราะการวาดมือ/คนด้วยรูปทรง
   เรขาคณิตง่ายๆ มักออกมาดูหยาบ (เจอปัญหานี้มาก่อนตอนทำ SVG มวยไทย) วิธีนี้สื่อความได้แม่นยำกว่า
   และเข้าธีมเดียวกับไดอะแกรมอื่นในไฟล์นี้ที่เป็นรูปทรงเรขาคณิต/แผนผังล้วน */
function buildKnifeGripSvg() {
  var board = '<rect x="20" y="150" width="280" height="70" rx="6" fill="#C9A876" stroke="#8B6F47" stroke-width="2"/>';
  var blade = '<path d="M 90,170 L 230,150 L 235,158 L 100,182 Z" fill="#CBD5E1" stroke="#1F2430" stroke-width="2"/>';
  var handle = '<rect x="50" y="172" width="46" height="16" rx="6" fill="#5C4433" stroke="#1F2430" stroke-width="2" transform="rotate(-8 73 180)"/>';
  var food = ['178,160', '192,157', '206,161'].map(function (xy) {
    var xs = xy.split(',');
    return '<rect x="' + (xs[0] - 7) + '" y="' + (xs[1] - 6) + '" width="14" height="12" rx="2" fill="#74C69D" stroke="#1F2430" stroke-width="1.3"/>';
  }).join('');
  /* วงกลมประชี้จุดจับ (โคนใบมีดเหนือด้าม) + ป้าย Pinch Grip */
  var pinchCallout = '<circle cx="93" cy="171" r="17" fill="none" stroke="#C2410C" stroke-width="2" stroke-dasharray="4,3"/>' +
    svgArrow(93, 200, 93, 190, '#C2410C') +
    '<text x="93" y="216" font-size="11" font-weight="800" text-anchor="middle" fill="#C2410C">Pinch Grip</text>' +
    '<text x="93" y="228" font-size="9" text-anchor="middle" fill="#727C93">โคนใบมีดเหนือด้าม</text>';
  /* วงกลมประชี้จุดวางมือประคอง (เหนือกองอาหาร) + ป้าย Claw Grip */
  var clawCallout = '<circle cx="192" cy="159" r="20" fill="none" stroke="#0EA5E9" stroke-width="2" stroke-dasharray="4,3"/>' +
    svgArrow(192, 200, 192, 182, '#0EA5E9') +
    '<text x="192" y="216" font-size="11" font-weight="800" text-anchor="middle" fill="#0EA5E9">Claw Grip</text>' +
    '<text x="192" y="228" font-size="9" text-anchor="middle" fill="#727C93">งอปลายนิ้วหลบใบมีด</text>';
  return svgWrap(board + food + blade + handle + pinchCallout + clawCallout, 320, 236, 340, 'knife pinch grip and guiding claw grip position callouts diagram');
}
/* อนิเมชันท่าหั่นแบบ rocking chop — ปลายใบมีดเป็นจุดหมุน (pivot) แตะเขียงตลอด ด้ามยกขึ้น-ลง
   ใช้ SMIL animateTransform หมุนรอบจุดปลายมีดที่แน่นอน (เสถียรกว่า CSS transform-origin ที่เจอปัญหา
   มาก่อนกับไดอะแกรมคนเคลื่อนไหว — ปมนั้นคือ transform-box ตีความพิกัดผิดพื้นที่ พบตอนทำ SVG มวยไทย) */
function buildRockChopAnimSvg() {
  var board = '<rect x="10" y="150" width="280" height="18" rx="4" fill="#C9A876" stroke="#8B6F47" stroke-width="2"/>';
  var foodPile = '<g>' +
    ['60,148', '80,148', '100,148', '120,148', '140,148'].map(function (xy) {
      var xs = xy.split(','); return '<rect x="' + (xs[0] - 6) + '" y="140" width="12" height="10" rx="2" fill="#74C69D" stroke="#1F2430" stroke-width="1.3"/>';
    }).join('') + '</g>';
  var pivotX = 240, pivotY = 150; /* ปลายมีดแตะเขียงตลอด — จุดหมุนคงที่ */
  var blade = '<path d="M 60,110 L 240,150 L 235,159 L 55,124 Z" fill="#CBD5E1" stroke="#1F2430" stroke-width="2"/>';
  var handle = '<rect x="20" y="112" width="42" height="15" rx="6" fill="#5C4433" stroke="#1F2430" stroke-width="2" transform="rotate(14 41 119)"/>';
  var knifeGroup = '<g>' + blade + handle +
    '<animateTransform attributeName="transform" type="rotate" values="0 ' + pivotX + ' ' + pivotY + '; -18 ' + pivotX + ' ' + pivotY + '; 0 ' + pivotX + ' ' + pivotY + '" keyTimes="0;0.5;1" dur="0.9s" repeatCount="indefinite"/>' +
    '</g>';
  return svgWrap(board + foodPile + knifeGroup, 300, 180, 320, 'animated rocking chop knife technique diagram');
}
/* เปรียบเทียบขนาดชิ้นหั่น: Julienne / Brunoise / Dice (S-M-L) ตามสัดส่วนจริง (มม.) ย่อลงมาให้ดูชัด */
function buildCutSizesSvg() {
  var items = [
    { w: 6, h: 6, label: 'Brunoise', sub: '~3mm cube', color: '#C2410C' },
    { w: 10, h: 10, label: 'Small Dice', sub: '~5mm', color: '#DC2626' },
    { w: 22, h: 22, label: 'Medium Dice', sub: '~13mm', color: '#EA580C' },
    { w: 34, h: 34, label: 'Large Dice', sub: '~20mm', color: '#B45309' }
  ];
  var gap = 55, y0 = 110;
  /* คอลัมน์ Julienne แยกไว้ซ้ายสุด มีระยะห่างชัดเจนก่อนแถว dice จะเริ่ม กันป้ายข้อความชนกัน */
  var julX = 34;
  var x = 110;
  var parts = ['<rect x="' + julX + '" y="20" width="10" height="66" fill="#495057" opacity="0.85"/>',
    '<text x="' + julX + '" y="105" font-size="10" font-weight="800" text-anchor="middle" fill="#495057">Julienne</text>',
    '<text x="' + julX + '" y="117" font-size="9.5" text-anchor="middle" fill="#495057">~3×3×45mm</text>',
    '<line x1="70" y1="10" x2="70" y2="140" stroke="#D9DEE8" stroke-width="1.5" stroke-dasharray="3,3"/>'];
  items.forEach(function (it) {
    var cx = x + it.w / 2;
    parts.push('<rect x="' + x + '" y="' + (y0 - it.h) + '" width="' + it.w + '" height="' + it.h + '" fill="' + it.color + '" opacity="0.85"/>');
    parts.push('<text x="' + cx + '" y="' + (y0 + 16) + '" font-size="10" font-weight="800" text-anchor="middle" fill="' + it.color + '">' + it.label + '</text>');
    parts.push('<text x="' + cx + '" y="' + (y0 + 28) + '" font-size="9.5" text-anchor="middle" fill="' + it.color + '">' + it.sub + '</text>');
    x += it.w + gap;
  });
  return svgWrap(parts.join(''), 400, 145, 420, 'julienne and dice cut sizes comparison diagram, actual relative proportions');
}
/* มุมลับมีด: ตะวันตก (~20°/ข้าง) เทียบญี่ปุ่น (~15°/ข้าง) มองจากปลายใบมีด (cross-section) */
function buildSharpenAngleSvg() {
  function wedge(cx, cy, angleDeg, color, label, sub) {
    var half = angleDeg / 2;
    var len = 70;
    var rad = Math.PI / 180;
    var topX = cx + len * Math.sin(half * rad), topY = cy - len * Math.cos(half * rad);
    var botX = cx + len * Math.sin(half * rad), botY = cy + len * Math.cos(half * rad);
    return '<path d="M ' + cx + ',' + cy + ' L ' + topX + ',' + topY + ' L ' + (cx - 4) + ',' + cy + ' L ' + botX + ',' + botY + ' Z" fill="' + color + '" opacity="0.82" stroke="#1F2430" stroke-width="1.5"/>' +
      '<text x="' + cx + '" y="' + (cy + 95) + '" font-size="12" font-weight="800" text-anchor="middle" fill="' + color + '">' + label + '</text>' +
      '<text x="' + cx + '" y="' + (cy + 110) + '" font-size="10.5" text-anchor="middle" fill="' + color + '">' + sub + '</text>';
  }
  var w = wedge(90, 70, 40, '#EA580C', 'Western', '~18-22°/side');
  var j = wedge(230, 70, 30, '#0EA5E9', 'Japanese', '~12-17°/side');
  return svgWrap(w + j, 320, 195, 320, 'western versus japanese knife sharpening angle cross-section comparison diagram');
}
/* โซนอันตราย (Danger Zone) ของอุณหภูมิอาหาร 4-60°C แบคทีเรียโตเร็วที่สุดในช่วงนี้ */
function buildDangerZoneSvg() {
  return svgTempBar(-5, 100, [
    { from: -5, to: 4, color: '#0EA5E9', label: 'เย็น/แช่แข็ง ปลอดภัย', temp: '<4°C' },
    { from: 4, to: 60, color: '#DC2626', label: 'โซนอันตราย — แบคทีเรียโตเร็ว', temp: '4-60°C' },
    { from: 60, to: 100, color: '#16A34A', label: 'ร้อน ปลอดภัย', temp: '>60°C' }
  ], 'food temperature danger zone diagram, 4 to 60 degrees celsius is unsafe');
}
/* อุณหภูมิภายในขั้นต่ำที่ปลอดภัยตาม USDA แยกตามประเภทอาหาร */
function buildSafeTempsSvg() {
  return svgFactStrip([
    { title: '74°C', sub: 'สัตว์ปีกทุกชนิด', color: '#DC2626' },
    { title: '71°C', sub: 'เนื้อบด (วัว/หมู)', color: '#EA580C' },
    { title: '63°C', sub: 'สเต็ก/หมูชิ้น (+พัก 3 นาที)', color: '#F59E0B' },
    { title: '63°C', sub: 'ปลา (เนื้อขุ่น แยกง่าย)', color: '#0EA5E9' }
  ], 'USDA safe minimum internal cooking temperatures by food type diagram');
}
/* สเปกตรัมความร้อนแบบเปียก: Poach → Simmer → Boil เรียงจากอุณหภูมิต่ำไปสูง */
function buildWetHeatSvg() {
  /* ช่วง Boil ขยายไป 98-112 แทนที่จะเป็นแค่ 98-100 องศาจริง (กว้างแค่ 2°) เพราะแคบเกินกว่าจะ
     ใส่ป้ายข้อความ "100°C" ลงไปได้พอดี — เป็นแค่การขยายพื้นที่แสดงผลป้าย ไม่ใช่การอ้างว่าเดือดได้เกิน 100°C */
  return svgTempBar(50, 118, [
    { from: 60, to: 82, color: '#0EA5E9', label: 'Poach', temp: '60-82°C' },
    { from: 85, to: 96, color: '#EA580C', label: 'Simmer', temp: '85-96°C' },
    { from: 98, to: 112, color: '#DC2626', label: 'Boil', temp: '100°C' }
  ], 'poaching simmering boiling temperature spectrum diagram');
}
/* ไอคอนจริงจาก Lucide (lucide.dev, สัญญาอนุญาต ISC — โอเพนซอร์สฟรี ใช้ได้ทุกกรณีรวมเชิงพาณิชย์
   ไม่มีปัญหาลิขสิทธิ์ ไม่ต้องใส่เครดิตก็ได้ตามเงื่อนไขสัญญาอนุญาต) แทนที่จะวาดไอคอนเองซึ่งมักออกมา
   ดูหยาบ — คัดลอกเฉพาะ path ข้างในมา (ตัด <svg> ครอบนอกออก) แล้ว scale ให้เข้าขนาดไดอะแกรม
   ต้นฉบับ viewBox 0 0 24 24 ทุกไอคอน: https://lucide.dev/icons/ */
var LUCIDE_PATHS = {
  pot: '<path d="M2 12h20"/><path d="M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8"/><path d="m4 8 16-4"/>' +
    '<path d="m8.86 6.78-.45-1.81a2 2 0 0 1 1.45-2.43l1.94-.48a2 2 0 0 1 2.43 1.46l.45 1.8"/>',
  thermometer: '<path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/>',
  measuringCup: '<path d="M4.5 3h15"/><path d="M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3"/><path d="M6 14h12"/>'
};
function lucideIcon(pathsInner, cx, cy, size, color) {
  var s = size / 24;
  return '<g transform="translate(' + (cx - size / 2) + ',' + (cy - size / 2) + ') scale(' + s.toFixed(3) + ')" ' +
    'fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + pathsInner + '</g>';
}
/* แถวไอคอนอุปกรณ์ครัวพื้นฐาน 5 ชิ้น — มีดเชฟใช้รูปทรงเรขาคณิตเองต่อ (ใบมีดตรง+ด้าม) เพราะไอคอน
   "pocket-knife" ของ Lucide เป็นมีดพับ ไม่ใช่มีดเชฟใบตรง ใช้แทนกันไม่ได้ ส่วนอีก 3 ชิ้นใช้ไอคอนจริง */
function buildEquipmentIconsSvg() {
  /* วาดเป็น outline ล้วน (fill:none) ให้เข้าสไตล์เดียวกับไอคอน Lucide เส้นล้วนอีก 3 ชิ้น */
  var knifeIcon = '<path d="M -15,3 L 10,-9 L 12,-5 L -13,7 Z" fill="none" stroke="#EA580C" stroke-width="2" stroke-linejoin="round"/>' +
    '<rect x="-24" y="1" width="12" height="8" rx="3" fill="none" stroke="#EA580C" stroke-width="2" transform="rotate(-8 -18 5)"/>';
  var items = [
    { label: 'Chef\'s Knife', color: '#EA580C', icon: knifeIcon },
    { label: 'Cutting Board', color: '#8B6F47', icon: '<rect x="-22" y="-12" width="44" height="24" rx="4" fill="#C9A876" stroke="#8B6F47" stroke-width="2"/>' },
    { label: 'Saucepan', color: '#495057', icon: lucideIcon(LUCIDE_PATHS.pot, 0, 0, 30, '#495057') },
    { label: 'Thermometer', color: '#DC2626', icon: lucideIcon(LUCIDE_PATHS.thermometer, 0, 0, 30, '#DC2626') },
    { label: 'Measuring Cup', color: '#0EA5E9', icon: lucideIcon(LUCIDE_PATHS.measuringCup, 0, 0, 30, '#0EA5E9') }
  ];
  var gap = 90, y = 70;
  var parts = items.map(function (it, i) {
    var cx = 55 + i * gap;
    return '<g transform="translate(' + cx + ',' + y + ')">' + it.icon +
      '<text x="0" y="34" font-size="10.5" font-weight="800" text-anchor="middle" fill="' + it.color + '">' + it.label + '</text></g>';
  }).join('');
  return svgWrap(parts, 55 + (items.length - 1) * gap + 55, 130, 560, 'basic kitchen equipment icons diagram');
}

/* ══════════════════════════════════════════════════════════════════
   แทร็ก "พื้นฐานการทำครัว" — Stage 1 (สูตรอาหารแยกตามประเทศเป็น Stage ถัดไป)
   ข้อมูลค้นจากเว็บจริง: USDA FSIS (อุณหภูมิปลอดภัย), Escoffier/Webstaurant (ขนาดการหั่น),
   Japanese Knife Lab/Musashi (มุมลับมีด) — ไม่ได้แต่งตัวเลขขึ้นเอง
   ══════════════════════════════════════════════════════════════════ */
var TRACKS = [
  {
    id: 'kitchen-basics',
    label: { th: 'พื้นฐานการทำครัว', en: 'Kitchen Fundamentals' },
    group: { th: 'พื้นฐาน', en: 'Fundamentals' },
    items: [
      readingItem(
        'การจับมีดและท่าหั่นพื้นฐาน', 'Knife Grip & Basic Cutting Techniques',
        [
          'จับด้ามมีดแบบ "Pinch Grip" — ใช้นิ้วโป้งกับข้อนิ้วชี้หนีบที่โคนใบมีด (เหนือด้ามจับ) ไม่ใช่กำด้ามเต็มมือ วิธีนี้ควบคุมทิศทางใบมีดได้แม่นและลดอาการล้ามือเวลาหั่นนาน ๆ',
          'มืออีกข้างที่ประคองอาหารต้องงอปลายนิ้วเป็น "Claw Grip" (ท่ากรงเล็บ) ใช้ข้อนิ้วส่วนบนดันใบมีดขณะเคลื่อนอาหาร ปลายนิ้วต้องหลบเข้าด้านในเสมอ ไม่ยื่นออกมาเสี่ยงโดนใบมีด',
          'ท่าหั่นพื้นฐานที่ใช้บ่อยที่สุดคือ Rocking Chop — ปลายใบมีดแตะเขี่ยงตลอดเวลาเป็นจุดหมุน ยกด้ามขึ้น-ลงเป็นจังหวะ ไม่ต้องยกใบมีดออกจากเขียงทั้งอัน ทำให้หั่นเร็วและปลอดภัยกว่า',
          'Julienne (ซอยเส้น): หั่นเป็นเส้นบางขนาดประมาณ 3×3 มม. ยาว 4-5 ซม. คล้ายไม้ขีดไฟ นิยมใช้กับผัดที่ต้องการให้สุกเร็วเท่ากันทุกชิ้น',
          'Brunoise: เอาเส้น Julienne มาหั่นตัดขวางอีกทีให้เป็นลูกเต๋าเล็กมาก ๆ ขนาดประมาณ 3 มม. ใช้แต่งหน้าซุปหรือใส่ในซอสที่ต้องการเนื้อสัมผัสละเอียด',
          'Dice (หั่นเต๋า) มี 3 ขนาดมาตรฐาน: เต๋าเล็ก (Small, ~5 มม.), เต๋ากลาง (Medium, ~13 มม.), เต๋าใหญ่ (Large, ~20 มม.) — เลือกขนาดตามเวลาที่ต้องการให้สุก ชิ้นเล็กสุกเร็วกว่าชิ้นใหญ่',
          'Chiffonade ใช้กับผักใบและสมุนไพร: ซ้อนใบให้เป็นตั้ง ม้วนใบให้แน่นเหมือนซิการ์ แล้วซอยขวางเป็นเส้นริบบิ้นบาง ๆ วิธีนี้ทำให้ใบไม่ช้ำเป็นรอยดำจากการหั่นสับตรง ๆ'
        ],
        [
          'Hold the knife with a "Pinch Grip" — thumb and the knuckle of your index finger pinching the blade just above the handle, not gripping the handle with a full fist. This gives much more precise control and reduces hand fatigue during long prep sessions.',
          'Your guiding hand must curl its fingertips into a "Claw Grip" — using the top knuckles to guide the blade while moving the food, with fingertips always tucked in, never extended where the blade could reach them.',
          'The most common cutting motion is the Rocking Chop — the knife tip stays in contact with the board as a pivot point while the handle rises and falls rhythmically, without ever fully lifting the blade off the board. This is both faster and safer.',
          'Julienne: thin matchstick strips roughly 3×3mm, 4-5cm long. Common for stir-fries because every piece cooks at the same even rate.',
          'Brunoise: julienne strips cut crosswise again into very fine cubes, roughly 3mm — used to garnish soups or add fine texture to sauces.',
          'Dice comes in 3 standard sizes: small (~5mm), medium (~13mm), and large (~20mm) — pick the size based on desired cooking time; smaller pieces cook faster than larger ones.',
          'Chiffonade is used for leafy vegetables and herbs: stack the leaves, roll them tightly like a cigar, then slice crosswise into thin ribbons — this avoids the bruised, blackened edges that come from chopping leaves directly.'
        ],
        buildKnifeGripSvg() + buildRockChopAnimSvg() + buildCutSizesSvg()),

      readingItem(
        'การลับมีดและการดูแลมีด', 'Knife Sharpening & Care',
        [
          'มีดตะวันตก (เช่น German/French chef\'s knife) ลับที่มุมประมาณ 18-22 องศาต่อข้าง (รวมสองข้าง ~36-44°) เน้นความทนทาน ใช้งานหนักได้โดยคมไม่บิ่นง่าย',
          'มีดญี่ปุ่น (เช่น Santoku, Gyuto) ลับที่มุมแคบกว่าคือประมาณ 12-17 องศาต่อข้าง ทำให้คมกว่ามากแต่เปราะกว่า เหมาะกับงานหั่นละเอียดมากกว่าสับกระดูก',
          'อย่าสับสนระหว่าง "Honing" กับ "Sharpening" — Honing (ใช้เหล็กแกว่ง/honing rod) แค่ดัดคมมีดที่งอเล็กน้อยให้ตรงแนวเดิม ไม่ได้ลับเอาเนื้อโลหะออก ควรทำทุกครั้งก่อนใช้งาน ส่วน Sharpening (ใช้หินลับ/whetstone) คือการฝนเอาเนื้อโลหะออกจริง ๆ เพื่อสร้างคมใหม่ ทำเมื่อคมเริ่มทื่อจริง ๆ เท่านั้น (ไม่ต้องทำบ่อย)',
          'หินลับแบ่งตามเบอร์ (grit): เบอร์หยาบ 220-1000 ใช้ซ่อมคมที่บิ่น/ทื่อมาก, เบอร์กลาง 1000-3000 ใช้ลับทั่วไป, เบอร์ละเอียด 3000-8000 ใช้ขัดเงาคมขั้นสุดท้าย',
          'ดูแลมีดให้อยู่ทนนาน: ล้างมือด้วยมือทันทีหลังใช้แล้วเช็ดแห้ง (ห้ามแช่ในอ่างล้างจานหรือเข้าเครื่องล้างจาน), ใช้เขียงไม้หรือพลาสติกเท่านั้น (เขียงแก้ว/หินทำให้คมมีดทื่อเร็วมาก), เก็บมีดในบล็อกไม้หรือฝักหุ้มคม ไม่ใส่ปนกับช้อนส้อมในลิ้นชักเพราะจะกระทบกันจนบิ่น'
        ],
        [
          'Western knives (e.g. German/French chef\'s knives) are sharpened at roughly 18-22° per side (~36-44° total), prioritizing durability for heavy daily use without chipping easily.',
          'Japanese knives (e.g. Santoku, Gyuto) use a narrower angle, roughly 12-17° per side — noticeably sharper but more brittle, better suited to fine slicing than to cutting through bone.',
          'Don\'t confuse "honing" with "sharpening" — honing (using a honing rod) just straightens a slightly bent edge back into alignment, removing no metal; do it before every use. Sharpening (using a whetstone) actually grinds away metal to form a new edge, and should only be done once the blade is genuinely dull (not often).',
          'Whetstones are graded by grit: coarse 220-1000 for repairing a chipped or very dull edge, medium 1000-3000 for general sharpening, fine 3000-8000 for the final polish.',
          'Keep your knife lasting longer: hand-wash and dry immediately after use (never soak in the sink or run through a dishwasher), only use wood or plastic cutting boards (glass or stone boards dull an edge very quickly), and store the knife in a block or sheath rather than loose in a drawer where it can knock against cutlery and chip.'
        ],
        buildSharpenAngleSvg()),

      readingItem(
        'การเตรียมส่วนผสม (Mise en Place)', 'Ingredient Prep (Mise en Place)',
        [
          '"Mise en Place" เป็นภาษาฝรั่งเศส แปลว่า "ทุกอย่างอยู่ในที่ของมัน" — คือการล้าง หั่น ชั่งตวง และจัดวัตถุดิบทุกอย่างให้พร้อมก่อนเริ่มลงมือทำอาหารจริง ไม่ใช่หั่นไปทำไป เพราะบางขั้นตอน (เช่นผัดไฟแรง) ไม่มีเวลาให้หยุดหั่นระหว่างทาง',
          'การล้างผัก/ผลไม้: ล้างด้วยน้ำไหลผ่านเสมอ ไม่แช่แช่นิ่งนาน ๆ (สารตกค้างอาจกลับเข้าไปในเนื้อผักได้) ผักใบควรแยกใบล้างให้ทั่วถึงซอกใบ',
          'การหมัก (Marinating): กรดในน้ำหมัก (มะนาว/น้ำส้มสายชู) ช่วยให้เนื้อสัมผัสนุ่มขึ้นแต่ถ้าหมักนานเกินไปจะทำให้เนื้อสัมผัสเละแทน เนื้อชิ้นเล็กหมัก 30 นาที-2 ชั่วโมงพอ เนื้อชิ้นใหญ่หมักได้นานถึงข้ามคืนในตู้เย็น',
          'การลวก (Blanching): ต้มผักในน้ำเดือดจัดสั้น ๆ (30 วินาที-2 นาทีแล้วแต่ชนิด) แล้วรีบช้อนใส่น้ำแข็งทันทีเพื่อหยุดความร้อน วิธีนี้ทำให้ผักสีเขียวสดขึ้น คงเนื้อกรอบ และยังใช้ลอกเปลือกมะเขือเทศ/ลูกพีชได้ง่ายขึ้นด้วย',
          'วัตถุดิบทำขนมอบ (เนย ไข่ นม) ควรตั้งไว้ที่อุณหภูมิห้องก่อนใช้ เพราะเนยเย็นจัดตีไม่ขึ้นฟู ไข่เย็นจัดผสมเข้ากับแป้ง/น้ำตาลได้ไม่ดีเท่าไข่อุณหภูมิห้อง'
        ],
        [
          '"Mise en place" is French for "everything in its place" — washing, cutting, measuring, and arranging every ingredient before you actually start cooking, rather than prepping as you go, since some steps (like high-heat stir-frying) leave no time to stop and chop mid-cook.',
          'Washing produce: always rinse under running water rather than soaking in standing water (residue can otherwise re-absorb into the vegetable). Leafy greens should be separated leaf by leaf to reach every fold.',
          'Marinating: acid in a marinade (lime juice, vinegar) tenderizes meat, but marinating too long makes the texture mushy instead. Small cuts need only 30 minutes to 2 hours; larger cuts can marinate overnight in the fridge.',
          'Blanching: briefly boil vegetables (30 seconds to 2 minutes depending on type), then immediately transfer to ice water to stop the cooking. This brightens green color, keeps a crisp texture, and also makes peeling tomatoes or peaches much easier.',
          'Baking ingredients (butter, eggs, milk) should sit at room temperature before use — cold butter won\'t cream properly, and cold eggs blend into flour and sugar far less evenly than room-temperature ones.'
        ],
        svgFlowSteps([
          { title: 'ล้าง', sub: 'Wash', color: '#0EA5E9' },
          { title: 'หั่น', sub: 'Cut', color: '#EA580C' },
          { title: 'ตวง', sub: 'Measure', color: '#F59E0B' },
          { title: 'จัดวาง', sub: 'Arrange', color: '#16A34A' }
        ], 'mise en place workflow: wash, cut, measure, arrange diagram') +
        timerWidgetHtml('blanch', 2, 'ลองจับเวลาลวกผัก (ตั้งต้น 2 นาที)', 'Try timing a blanch (starts at 2 min)')),

      readingItem(
        'เทคนิคการทำอาหารพื้นฐาน', 'Basic Cooking Techniques',
        [
          'ความร้อนแห้ง (Dry Heat) ไม่ใช้น้ำ/ของเหลวเป็นตัวนำความร้อน: Sautéing (ผัดไฟแรงในน้ำมันน้อย ขยับกระทะตลอด), Pan-frying (ทอดในน้ำมันปานกลาง), Deep-frying (ทอดจมน้ำมัน), Grilling/Roasting (ย่าง/อบด้วยความร้อนแห้งโดยตรงหรือในเตาอบ)',
          'ความร้อนเปียก (Moist Heat) ใช้น้ำหรือไอน้ำนำความร้อน แบ่งตามอุณหภูมิ: Boiling ต้มเดือดจัด 100°C ฟองผุดแรง, Simmering ประมาณ 85-96°C ฟองเบา ๆ ผุดเป็นจังหวะ (ใช้ทำสตูว์/ซอสส่วนใหญ่ เพราะต้มเดือดจัดเกินไปจะทำให้เนื้อสัตว์เหนียวและซอสแตกมัน), Poaching ประมาณ 60-82°C อ่อนโยนที่สุด แทบไม่มีฟองผุด เหมาะกับของบอบบางอย่างไข่ดาวน้ำหรือปลาเนื้อนุ่ม',
          'Steaming (นึ่ง): ใช้ไอน้ำร้อนโดยอาหารไม่สัมผัสน้ำโดยตรง รักษาสารอาหารและรสชาติได้ดีกว่าการต้ม เพราะสารอาหารไม่ละลายหายไปกับน้ำ',
          'เทคนิคผสม (Combination): Braising คือเอาเนื้อไปย่าง/ทอดให้สีสวยก่อน (เพื่อรสชาติจาก Maillard reaction) แล้วค่อยเคี่ยวต่อในของเหลวปริมาณน้อยด้วยไฟอ่อนนาน ๆ ให้เนื้อเปื่อยนุ่ม เหมาะกับเนื้อส่วนที่มีพังผืดเยอะ'
        ],
        [
          'Dry heat methods don\'t use water/liquid to conduct heat: Sautéing (high heat, small amount of oil, constant pan motion), Pan-frying (medium amount of oil), Deep-frying (fully submerged in oil), Grilling/Roasting (direct dry heat or oven heat).',
          'Moist heat methods use water or steam to conduct heat, categorized by temperature: Boiling at a full 100°C with vigorous bubbling; Simmering at roughly 85-96°C with gentle, rhythmic bubbles (used for most stews and sauces, since a full boil toughens meat and breaks sauces); Poaching at roughly 60-82°C, the gentlest method with almost no bubbling, suited to delicate items like poached eggs or tender fish.',
          'Steaming: hot steam cooks food without direct water contact, preserving nutrients and flavor better than boiling since nothing dissolves away into the cooking water.',
          'Combination methods: braising sears or roasts meat first for color and Maillard-reaction flavor, then slow-cooks it in a small amount of liquid over low heat for a long time until tender — ideal for tougher, connective-tissue-rich cuts.'
        ],
        buildWetHeatSvg()),

      readingItem(
        'ความปลอดภัยในครัว', 'Kitchen Safety & Food Safety',
        [
          'โซนอันตราย (Danger Zone) ของอุณหภูมิอาหารคือ 4-60°C — แบคทีเรียเติบโตเร็วที่สุดในช่วงนี้ อาหารไม่ควรอยู่ในช่วงอุณหภูมินี้เกิน 2 ชั่วโมง (หรือ 1 ชั่วโมงถ้าอากาศร้อนกว่า 32°C) ต้องรีบแช่เย็นหรือเก็บร้อนต่อทันที',
          'อุณหภูมิภายในขั้นต่ำที่ปลอดภัย (ตามมาตรฐาน USDA): สัตว์ปีกทุกชนิด 74°C, เนื้อบด (วัว/หมู) 71°C, เนื้อชิ้น/สเต็ก/หมูชิ้น 63°C แล้วพักไว้อย่างน้อย 3 นาทีก่อนตัด (อุณหภูมิจะไต่ขึ้นต่อระหว่างพัก), ปลา 63°C หรือจนเนื้อขุ่นและแยกเป็นชั้นง่ายด้วยส้อม',
          'ป้องกันการปนเปื้อนข้าม (Cross-Contamination): ใช้เขียง/มีดแยกกันระหว่างเนื้อดิบกับผัก-ผลไม้ที่กินสด ๆ เด็ดขาด ล้างมือทุกครั้งหลังจับเนื้อดิบก่อนไปจับอย่างอื่นต่อ',
          'ความปลอดภัยเรื่องไฟ: ห้ามใช้น้ำดับไฟไหม้จากน้ำมัน/ไขมันเด็ดขาด (น้ำจะทำให้น้ำมันกระเด็นไฟลุกลามหนักขึ้น) ให้ปิดฝาหม้อ/กระทะเพื่อตัดออกซิเจน หรือใช้ผงเบกกิ้งโซดาปริมาณมาก หรือถังดับเพลิงประเภท K เท่านั้น'
        ],
        [
          'The food temperature danger zone is 4-60°C — bacteria multiply fastest in this range. Food shouldn\'t sit in this range for more than 2 hours (or 1 hour if the ambient temperature is above 32°C) — refrigerate or keep it properly hot right away.',
          'Safe minimum internal temperatures (per USDA standards): all poultry 74°C, ground meat (beef/pork) 71°C, whole cuts/steaks/pork chops 63°C followed by at least a 3-minute rest before cutting (temperature keeps rising during the rest), fish 63°C or until the flesh turns opaque and flakes easily with a fork.',
          'Preventing cross-contamination: always use separate cutting boards/knives for raw meat versus produce that will be eaten raw. Wash your hands every time after handling raw meat before touching anything else.',
          'Fire safety: never use water to put out a grease/oil fire — water causes the burning oil to splatter and the fire to spread worse. Instead smother it by covering the pot/pan to cut off oxygen, use a large amount of baking soda, or use a Class K fire extinguisher only.'
        ],
        buildDangerZoneSvg() + buildSafeTempsSvg()),

      readingItem(
        'อุปกรณ์ครัวพื้นฐาน', 'Basic Kitchen Equipment',
        [
          'มีดที่ต้องมี 3 เล่มเป็นอย่างน้อย: Chef\'s Knife (มีดเชฟ) ใบยาว 20-25 ซม. ใช้ได้แทบทุกงาน, Paring Knife (มีดปอก) ใบสั้นสำหรับงานละเอียดอย่างปอกเปลือกหรือแกะไส้, Bread Knife (มีดหยัก) ใบมีดฟันเลื่อยสำหรับตัดขนมปังโดยไม่บี้เนื้อใน',
          'หม้อ/กระทะพื้นฐาน: Saucepan (หม้อด้ามยาวใบเล็ก-กลาง) สำหรับต้มซอส/ซุปปริมาณน้อย, Stockpot (หม้อใบใหญ่) สำหรับต้มน้ำซุปหรือลวกพาสต้าปริมาณมาก, Sauté Pan/กระทะ (ก้นแบนขอบตรง) สำหรับผัด/ทอด, กระทะเคลือบสารกันติด (Non-stick) เหมาะกับไข่ดาวและอาหารที่ติดกระทะง่าย',
          'เครื่องมือที่ควรมีติดครัว: เขียง (แยกสีสำหรับเนื้อดิบกับผัก), เทอร์โมมิเตอร์วัดอุณหภูมิอาหาร (เช็คความสุกแม่นกว่าการกะด้วยตา), ถ้วย/ช้อนตวงมาตรฐาน, คีมคีบอาหาร (Tongs) สำหรับพลิกกลับอาหารโดยไม่ต้องใช้ส้อมแทงเสียน้ำเนื้อ'
        ],
        [
          'You need at least 3 knives: a Chef\'s Knife (20-25cm blade) for almost everything, a Paring Knife (short blade) for fine detail work like peeling or coring, and a Bread Knife (serrated blade) for cutting bread without crushing the crumb.',
          'Basic pots/pans: a Saucepan (small-to-medium, long handle) for cooking sauces or small batches of soup, a Stockpot (large) for making broth or boiling large amounts of pasta, a Sauté Pan (flat bottom, straight sides) for sautéing/frying, and a Non-stick pan, ideal for eggs and other food that sticks easily.',
          'Essential tools to keep on hand: cutting boards (separate colors for raw meat vs. produce), a food thermometer (far more accurate than guessing doneness by eye), standard measuring cups/spoons, and tongs for flipping food without piercing it with a fork and losing juices.'
        ],
        buildEquipmentIconsSvg()),

      readingItem(
        'หน่วยตวงและการแปลงหน่วย', 'Measurement Units & Conversion',
        [
          'หน่วยตวงมาตรฐานที่ใช้บ่อย: 1 ช้อนโต๊ะ (tbsp) = 3 ช้อนชา (tsp) = 15 มล., 1 ถ้วยตวง (cup) = 16 ช้อนโต๊ะ = 240 มล. — ตัวเลขเหล่านี้เป็นมาตรฐานสากล (US customary) ที่สูตรอาหารส่วนใหญ่อ้างอิงถึง',
          'การแปลงน้ำหนัก↔ปริมาตรทำได้แค่ "โดยประมาณ" เท่านั้น เพราะขึ้นกับความหนาแน่นของวัตถุดิบแต่ละชนิด เช่น แป้ง 1 ถ้วยหนักราว 120 กรัม แต่น้ำตาลทราย 1 ถ้วยหนักราว 200 กรัม ทั้งที่ปริมาตรเท่ากัน — ถ้าสูตรระบุน้ำหนักเป็นกรัมมา ควรใช้ตาชั่งจริงแทนการตวงด้วยถ้วยเสมอเพื่อความแม่นยำ',
          'ใช้เครื่องมือแปลงหน่วยด้านล่างนี้ได้เลยเวลาทำสูตรจากต่างประเทศที่ใช้หน่วยไม่ตรงกับที่บ้านคุ้นเคย'
        ],
        [
          'Common standard measures: 1 tablespoon (tbsp) = 3 teaspoons (tsp) = 15ml, 1 cup = 16 tbsp = 240ml — these are the US customary values most recipes reference.',
          'Converting weight↔volume is only ever "approximate," since it depends on each ingredient\'s density — for example 1 cup of flour weighs roughly 120g, while 1 cup of granulated sugar weighs roughly 200g despite being the same volume. If a recipe gives weight in grams, always use a real kitchen scale instead of a measuring cup for accuracy.',
          'Use the converter tool below whenever you\'re working from a foreign recipe that uses units you\'re not used to.'
        ],
        '<div id="unitConvWidget"></div>')
    ]
  },
  {
    id: 'thai-recipes',
    label: { th: 'สูตรอาหารไทย', en: 'Thai Recipes' },
    group: { th: 'สูตรอาหาร', en: 'Recipes' },
    items: [
      readingItem(
        'ต้มยำกุ้ง (Tom Yum Goong)', 'Tom Yum Goong (Thai Hot & Sour Shrimp Soup)',
        [
          'ต้มยำกุ้งคือต้มยำแบบใสที่มีชื่อเสียงที่สุดของไทย รสชาติเปรี้ยว-เผ็ด-เค็ม-หอมกลมกล่อม หัวใจสำคัญคือ "สามเกลอต้มยำ" — ตะไคร้ ข่า และใบมะกรูด สมุนไพรสามชนิดนี้ให้กลิ่นหอมเฉพาะตัวที่ขาดไม่ได้ ต้มแค่เคี่ยวให้กลิ่นออกมาในน้ำซุป ไม่ต้องกินตัวสมุนไพรเอง',
          'วัตถุดิบ (สำหรับ 2-3 ที่): กุ้งแม่น้ำหรือกุ้งขาว 300 กรัม (เก็บหัว-เปลือกไว้ต้มน้ำซุป), ตะไคร้ 2 ต้น (ทุบ หั่นท่อน), ข่า 4-5 แว่น (ทุบพอแตก), ใบมะกรูด 4-5 ใบ (ฉีกให้กลิ่นออก), พริกขี้หนู 5-10 เม็ด (ทุบพอแตก), เห็ดฟาง 100 กรัม, มะเขือเทศ 1 ลูก (หั่นชิ้น), หอมแดง 3-4 หัว (ทุบ), น้ำพริกเผา 2 ช้อนโต๊ะ, น้ำปลา 3 ช้อนโต๊ะ, น้ำมะนาว 3-4 ช้อนโต๊ะ, น้ำตาลปีบเล็กน้อย, ผักชีซอย',
          'ขั้นตอน: (1) ต้มน้ำเปล่าให้เดือด ใส่หัว-เปลือกกุ้งลงต้มให้น้ำเป็นสีส้มออกรสหวานจากกุ้งก่อน แล้วช้อนเปลือกทิ้ง (หรือใช้น้ำซุปกุ้งสำเร็จแทนได้) (2) ใส่ตะไคร้ ข่า ใบมะกรูด หอมแดง พริกขี้หนูทุบลงต้มรวมกันให้กลิ่นหอมออกมาเต็มที่ ปิดฝาหม้อช่วยให้เดือดเร็วขึ้น (3) ใส่น้ำพริกเผาและน้ำปลา คนให้ละลายเข้ากัน ชิมรส (4) ใส่เห็ดฟางและมะเขือเทศ ต้มจนเห็ดสุก แล้วใส่กุ้งลงไปต้มแค่ 30 วินาที-1 นาทีจนกุ้งสุกพอดี (ต้มนานเกินไปเนื้อกุ้งจะเหนียว) (5) ปิดไฟ บีบน้ำมะนาวใส่ตอนจะเสิร์ฟเท่านั้น (ใส่ตอนน้ำยังเดือดจะทำให้รสขมและกลิ่นมะนาวหายไป) โรยผักชี เสิร์ฟทันที',
          'เคล็ดลับ: น้ำพริกเผาคือตัวให้ความหอมมันและสีสวย ถ้าไม่มีน้ำซุปกุ้งจากเปลือกจริง รสชาติจะจืดกว่ามาก แนะนำให้เก็บเปลือกกุ้งไว้ต้มทุกครั้ง'
        ],
        [
          'Tom Yum Goong is Thailand\'s most famous clear-broth hot and sour soup — sour, spicy, salty, and fragrant all at once. Its soul is the "tom yum trinity": lemongrass, galangal, and kaffir lime leaves. These are simmered just to release their aroma into the broth — they aren\'t meant to be eaten.',
          'Ingredients (serves 2-3): 300g river prawns or shrimp (keep the heads and shells for stock), 2 stalks lemongrass (bruised, cut into lengths), 4-5 slices galangal (lightly crushed), 4-5 kaffir lime leaves (torn to release aroma), 5-10 Thai chilies (lightly crushed), 100g straw mushrooms, 1 tomato (cut into wedges), 3-4 shallots (crushed), 2 tbsp roasted chili paste (nam prik pao), 3 tbsp fish sauce, 3-4 tbsp lime juice, a little palm sugar, chopped cilantro.',
          'Steps: (1) Boil water and add the shrimp heads/shells to make a stock until the water turns orange and sweet, then strain out the shells (or use pre-made shrimp stock). (2) Add lemongrass, galangal, kaffir lime leaves, shallots, and crushed chilies; simmer with the lid on to release the aromatics faster. (3) Stir in the roasted chili paste and fish sauce until dissolved, taste and adjust. (4) Add straw mushrooms and tomato, simmer until the mushrooms are cooked, then add the shrimp and cook for just 30 seconds to 1 minute until just done (overcooking makes the shrimp rubbery). (5) Turn off the heat and squeeze in lime juice only right before serving (adding it while still boiling makes it bitter and burns off the aroma). Garnish with cilantro and serve immediately.',
          'Tip: the roasted chili paste is what gives the soup its rich aroma, body, and reddish color. Without real shrimp-shell stock the flavor will be noticeably flatter — always save the shells to make stock.'
        ],
        svgFactStrip([
          { title: 'ตะไคร้', sub: 'Lemongrass', color: '#16A34A' },
          { title: 'ข่า', sub: 'Galangal', color: '#F59E0B' },
          { title: 'ใบมะกรูด', sub: 'Kaffir Lime Leaf', color: '#0EA5E9' }
        ], 'tom yum trinity herbs: lemongrass galangal kaffir lime leaf diagram') +
        svgFlowSteps([
          { title: 'ต้มน้ำซุปกุ้ง', sub: 'Shrimp stock', color: '#EA580C' },
          { title: 'ใส่สมุนไพร', sub: 'Add herbs', color: '#16A34A' },
          { title: 'ใส่พริกเผา+ปลา', sub: 'Paste+fish sauce', color: '#F59E0B' },
          { title: 'ใส่กุ้ง 30 วิ', sub: 'Shrimp 30s', color: '#DC2626' },
          { title: 'บีบมะนาวปิดไฟ', sub: 'Lime off-heat', color: '#0EA5E9' }
        ], 'tom yum goong cooking process flow diagram')),

      readingItem(
        'ผัดไทย (Pad Thai)', 'Pad Thai',
        [
          'ผัดไทยคือก๋วยเตี๋ยวผัดเส้นจันท์ที่มีรสชาติกลมกล่อมครบทั้งเปรี้ยว-หวาน-เค็ม-อูมามิในคำเดียว หัวใจสำคัญคือ "ซอสผัดไทย" ที่ทำจากมะขามเปียก น้ำปลา และน้ำตาลปีบ ต้องเคี่ยวให้ได้สัดส่วนที่สมดุลก่อนนำไปผัด',
          'ซอสผัดไทย (สำหรับ 4 ที่): น้ำมะขามเปียกข้น 5 ช้อนโต๊ะ, น้ำปลา 3 ช้อนโต๊ะ, น้ำตาลปีบ 3 ช้อนโต๊ะ, น้ำเปล่า 1 ช้อนโต๊ะ — เคี่ยวน้ำตาลปีบในหม้อไฟกลางจนละลายเป็นสีเข้มขึ้น แล้วใส่น้ำ น้ำปลา น้ำมะขามเปียกตามลงไป เคี่ยวไฟอ่อนคนเรื่อย ๆ ประมาณ 5 นาทีจนซอสข้นเข้ากัน',
          'วัตถุดิบผัด: เส้นจันท์แช่น้ำนิ่ม 200 กรัม, กุ้งหรือเต้าหู้แข็ง, ไข่ 2 ฟอง, ถั่วงอก, กุยช่าย, หัวไชโป๊วสับ, ถั่วลิสงป่น, กระเทียมสับ, น้ำมันสำหรับผัด',
          'ขั้นตอน: (1) ตั้งกระทะไฟแรง ใส่น้ำมัน ผัดกระเทียมกับหัวไชโป๊วให้หอม (2) ใส่กุ้ง/เต้าหู้ผัดให้สุก ดันไปข้างกระทะ ตอกไข่ลงตรงกลาง คนไข่ให้กระจายแล้วคลุกรวมกับของที่ดันไว้ (3) ใส่เส้นจันท์ที่แช่นิ่มแล้ว ราดซอสผัดไทยลงไป ผัดเร็ว ๆ ให้เส้นซึมซอสทั่วโดยไม่ให้เส้นแฉะเกินไป (4) ใส่ถั่วงอกครึ่งหนึ่งกับกุยช่ายหั่นท่อน ผัดเร็ว ๆ ให้ผักยังกรอบอยู่ (5) ปิดไฟ ตักใส่จาน โรยถั่วลิสงป่น เสิร์ฟพร้อมถั่วงอกสด มะนาว และพริกป่นแยกต่างหาก',
          'เคล็ดลับ: ห้ามผัดเส้นนานเกินไปเพราะเส้นจะเละ และควรผัดไฟแรงตลอดเพื่อให้ได้กลิ่นกระทะ (wok hei) แบบร้านข้างทาง'
        ],
        [
          'Pad Thai is stir-fried Chanthaburi rice noodles with a perfectly balanced sour-sweet-salty-umami flavor in every bite. Its heart is the "Pad Thai sauce" made from tamarind paste, fish sauce, and palm sugar — it must be reduced to the right balance before stir-frying.',
          'Pad Thai sauce (serves 4): 5 tbsp thick tamarind paste, 3 tbsp fish sauce, 3 tbsp palm sugar, 1 tbsp water — melt the palm sugar in a pot over medium heat until it darkens, then add water, fish sauce, and tamarind paste. Simmer on low heat, stirring, for about 5 minutes until thick and combined.',
          'Stir-fry ingredients: 200g dried chanthaburi rice noodles (soaked until soft), shrimp or firm tofu, 2 eggs, bean sprouts, garlic chives, chopped preserved radish, ground peanuts, chopped garlic, oil for frying.',
          'Steps: (1) Heat a wok on high heat with oil, stir-fry garlic and preserved radish until fragrant. (2) Add shrimp/tofu and cook through, push to the side of the wok, crack the eggs into the center, scramble, then mix everything together. (3) Add the soaked noodles and pour in the Pad Thai sauce, stir-fry quickly so the noodles absorb the sauce without becoming mushy. (4) Add half the bean sprouts and cut garlic chives, toss quickly so the vegetables stay crisp. (5) Turn off the heat, plate, sprinkle with ground peanuts, and serve with fresh bean sprouts, lime, and chili powder on the side.',
          'Tip: never stir-fry the noodles too long or they turn mushy, and keep the heat high throughout to get that smoky "wok hei" flavor from street-food stalls.'
        ],
        svgFactStrip([
          { title: '5 ช้อนโต๊ะ', sub: 'น้ำมะขามเปียก / Tamarind', color: '#B45309' },
          { title: '3 ช้อนโต๊ะ', sub: 'น้ำปลา / Fish sauce', color: '#0EA5E9' },
          { title: '3 ช้อนโต๊ะ', sub: 'น้ำตาลปีบ / Palm sugar', color: '#EA580C' }
        ], 'pad thai sauce ratio: tamarind fish sauce palm sugar diagram') +
        svgFlowSteps([
          { title: 'เคี่ยวซอส', sub: 'Make sauce', color: '#B45309' },
          { title: 'ผัดกระเทียม', sub: 'Fry garlic', color: '#16A34A' },
          { title: 'ใส่กุ้ง+ไข่', sub: 'Shrimp+egg', color: '#F59E0B' },
          { title: 'ใส่เส้น+ซอส', sub: 'Noodles+sauce', color: '#DC2626' },
          { title: 'ใส่ผักสด', sub: 'Add veg', color: '#0EA5E9' }
        ], 'pad thai cooking process flow diagram')),

      readingItem(
        'แกงเขียวหวานไก่ (Gaeng Keow Wan Gai)', 'Thai Green Curry with Chicken',
        [
          'แกงเขียวหวานคือแกงกะทิที่ใช้พริกแกงเขียวหวาน (ทำจากพริกขี้หนูเขียวสด ตะไคร้ ข่า ผิวมะกรูด กะปิ และเครื่องเทศ) ชื่อ "เขียวหวาน" มาจากสีเขียวของพริกแกงและรสชาติออกหวานนำเล็กน้อยจากกะทิ ไม่ใช่แปลว่าหวานจัด',
          'วัตถุดิบ (สำหรับ 3-4 ที่): เนื้อไก่หั่นชิ้น 300 กรัม, พริกแกงเขียวหวาน 3-4 ช้อนโต๊ะ, หัวกะทิ 200 มล., หางกะทิ 400 มล., มะเขือเปราะหรือมะเขือม่วงหั่นชิ้น, พริกชี้ฟ้าแดงหั่นเฉียง, ใบมะกรูดฉีก, ใบโหระพา, น้ำปลา 2-3 ช้อนโต๊ะ, น้ำตาลปีบ 1 ช้อนโต๊ะ',
          'ขั้นตอน: (1) ตั้งกระทะไฟกลาง-แรง ใส่หัวกะทิ (กะทิเข้มข้นที่ตักจากชั้นบนสุดของกระป๋อง) ผัดคนเรื่อย ๆ 3-5 นาทีจนน้ำมันแตกตัวลอยขึ้นมาเป็นมัน ๆ (เรียกว่า "แตกมัน") — ขั้นตอนนี้สำคัญมาก เป็นตัวดึงกลิ่นหอมของพริกแกงออกมาเต็มที่ (2) ใส่พริกแกงเขียวหวานลงผัดกับหัวกะทิที่แตกมันแล้ว 1-2 นาทีจนหอม (3) ใส่เนื้อไก่ลงผัดจนเนื้อเปลี่ยนเป็นสีขาวรอบนอก (4) เติมหางกะทิ พอเดือดใส่มะเขือลงต้ม ปรุงรสด้วยน้ำปลาและน้ำตาลปีบ (5) ปิดไฟ ใส่ใบมะกรูดฉีกกับใบโหระพา คนให้ทั่วก่อนยกลง (ใส่ตอนใกล้ปิดไฟเพื่อรักษากลิ่นหอมสด) เสิร์ฟกับข้าวสวยร้อน ๆ',
          'เคล็ดลับ: ขั้นตอน "แตกมัน" คือจุดตัดสินความอร่อย ถ้าข้ามขั้นตอนนี้ไปเลยใส่กะทิรวมกันหมด แกงจะไม่หอมมันเท่าที่ควร'
        ],
        [
          'Green curry is a coconut-milk curry made with green curry paste (fresh green Thai chilies, lemongrass, galangal, kaffir lime zest, shrimp paste, and spices). The name "green sweet" comes from the paste\'s green color and the mild sweetness from the coconut milk — it doesn\'t mean the dish is very sweet.',
          'Ingredients (serves 3-4): 300g chicken, cut into pieces, 3-4 tbsp green curry paste, 200ml coconut cream, 400ml coconut milk, sliced Thai eggplant or round eggplant, sliced red spur chilies, torn kaffir lime leaves, Thai basil, 2-3 tbsp fish sauce, 1 tbsp palm sugar.',
          'Steps: (1) Heat a wok on medium-high, add the coconut cream (the thick top layer) and stir continuously for 3-5 minutes until the oil separates and floats to the top — this "breaking the fat" step is critical, as it fully draws out the paste\'s aroma later. (2) Add the green curry paste and fry with the split coconut cream for 1-2 minutes until fragrant. (3) Add the chicken and stir-fry until the outside turns white. (4) Add the coconut milk, once boiling add the eggplant, then season with fish sauce and palm sugar. (5) Turn off the heat, add torn kaffir lime leaves and Thai basil, stir through before removing from heat (added near the end to preserve their fresh aroma). Serve with hot steamed rice.',
          'Tip: the "breaking the fat" step is what makes or breaks the dish\'s richness — skipping it and dumping in all the coconut milk at once results in a curry that\'s noticeably less aromatic and rich.'
        ],
        svgFlowSteps([
          { title: 'แตกมันกะทิ', sub: 'Split coconut cream', color: '#F59E0B' },
          { title: 'ผัดพริกแกง', sub: 'Fry paste', color: '#16A34A' },
          { title: 'ผัดไก่', sub: 'Cook chicken', color: '#EA580C' },
          { title: 'เติมกะทิ+มะเขือ', sub: 'Add milk+eggplant', color: '#0EA5E9' },
          { title: 'ใบมะกรูด+โหระพา', sub: 'Herbs off-heat', color: '#DC2626' }
        ], 'thai green curry cooking process flow diagram')),

      readingItem(
        'ส้มตำ (Som Tam)', 'Som Tam (Thai Green Papaya Salad)',
        [
          'ส้มตำคือสลัดมะละกอดิบสับเส้น รสจัดจ้านเปรี้ยว-เผ็ด-เค็ม-หวาน ปรุงด้วยครกไม้/ครกดินแบบดั้งเดิม เทคนิคการ "ตำ" ที่ถูกต้องสำคัญมาก เพราะต้องบุบให้เครื่องปรุงเข้าเนื้อมะละกอโดยที่มะละกอยังกรอบอยู่ ไม่ใช่ตำจนแหลก',
          'วัตถุดิบ (สำหรับ 2 ที่): มะละกอดิบสับเส้น 2 ถ้วย, กระเทียม 2-3 กลีบ, พริกขี้หนูสด 2-5 เม็ด (ปรับตามความเผ็ด), มะเขือเทศลูกเล็กผ่าซีก, ถั่วฝักยาวหั่นท่อน, กุ้งแห้งป่น 2-3 ช้อนโต๊ะ, ถั่วลิสงคั่วทุบหยาบ 2 ช้อนโต๊ะ, น้ำปลา 2 ช้อนโต๊ะ, น้ำมะนาว 2-3 ช้อนโต๊ะ, น้ำตาลปีบ 1-2 ช้อนโต๊ะ',
          'ขั้นตอน: (1) ใส่กระเทียมกับพริกขี้หนูลงครก ตำพอแตกหยาบ ๆ ไม่ต้องละเอียด (2) ใส่ถั่วฝักยาวกับถั่วลิสง ตำเบา ๆ ให้บุบพอช้ำแต่ยังกรอบ (3) ใส่มะเขือเทศ กุ้งแห้ง น้ำปลา น้ำมะนาว น้ำตาลปีบ ตำเบา ๆ ให้เข้ากัน (4) ใส่มะละกอสับลงไป ใช้เทคนิค "ตำสลับพลิก" คือตำเบา ๆ 3-4 ครั้งแล้วใช้ช้อนพลิกก้นครกขึ้นมาด้านบนสลับกันไปเรื่อย ๆ จนมะละกอเคลือบด้วยน้ำปรุงทั่วถึงแต่ยังกรอบอยู่ ชิมรสปรับตามชอบ',
          'เคล็ดลับ: ครกดินกับสากไม้ให้ผลลัพธ์ดีที่สุดเพราะน้ำหนักและพื้นผิวช่วยบุบเครื่องปรุงพอดี ไม่แหลกจนเป็นน้ำเหมือนใช้เครื่องปั่น'
        ],
        [
          'Som Tam is a shredded raw papaya salad with bold sour-spicy-salty-sweet flavor, traditionally made in a wooden or clay mortar and pestle. Getting the "pounding" technique right matters a lot — you need to bruise the ingredients enough for the dressing to penetrate while the papaya stays crisp, not pulverized.',
          'Ingredients (serves 2): 2 cups shredded green papaya, 2-3 cloves garlic, 2-5 Thai chilies (adjust to taste), halved cherry tomatoes, cut long beans, 2-3 tbsp ground dried shrimp, 2 tbsp roughly crushed roasted peanuts, 2 tbsp fish sauce, 2-3 tbsp lime juice, 1-2 tbsp palm sugar.',
          'Steps: (1) Add garlic and chilies to the mortar, pound until roughly broken down — no need to make it fine. (2) Add long beans and peanuts, pound gently until lightly bruised but still crisp. (3) Add tomatoes, dried shrimp, fish sauce, lime juice, and palm sugar, pound gently to combine. (4) Add the shredded papaya and use the "pound-and-flip" technique — pound gently 3-4 times, then use a spoon to flip the ingredients from the bottom to the top, repeating until the papaya is evenly coated with the dressing but still crisp. Taste and adjust.',
          'Tip: a clay mortar with a wooden pestle gives the best result — their weight and texture bruise the ingredients just right, unlike a blender which would turn everything into liquid.'
        ],
        svgFlowSteps([
          { title: 'ตำกระเทียม+พริก', sub: 'Garlic+chili', color: '#16A34A' },
          { title: 'ใส่ถั่วฝักยาว', sub: 'Long beans', color: '#0EA5E9' },
          { title: 'ปรุงรส', sub: 'Season', color: '#F59E0B' },
          { title: 'ตำสลับพลิก', sub: 'Pound & flip', color: '#DC2626' }
        ], 'som tam pounding technique process flow diagram')),

      readingItem(
        'ผัดกะเพราหมูสับ ไข่ดาว', 'Pad Kra Pao Moo Saap (Thai Holy Basil Pork) with Fried Egg',
        [
          'ผัดกะเพราคือเมนูจานเดียวยอดนิยมที่สุดของไทย หัวใจสำคัญคือ "ใบกะเพรา" (Holy Basil) ซึ่งมีกลิ่นฉุนเผ็ดร้อนคล้ายกานพลูเฉพาะตัว ต่างจาก "ใบโหระพา" (Thai Basil) ที่กลิ่นหอมอ่อนกว่าคล้ายชะเอม ห้ามใช้แทนกันเด็ดขาดถ้าอยากได้รสชาติแท้ ๆ',
          'วัตถุดิบ (สำหรับ 1-2 ที่): หมูสับ 200 กรัม, ใบกะเพรา 1 กำมือ, กระเทียม 5-6 กลีบ, พริกขี้หนู 5-10 เม็ด, ถั่วฝักยาวหั่นท่อน (ถ้าชอบ), ไข่ไก่ 1-2 ฟองสำหรับทอด, น้ำมันสำหรับทอดไข่, น้ำมันสำหรับผัด',
          'ซอสปรุงรส: น้ำปลา 1 ช้อนโต๊ะ, ซีอิ๊วขาว 1 ช้อนโต๊ะ, ซอสหอยนางรม 1 ช้อนโต๊ะ, น้ำตาล 1 ช้อนชา, ผสมรวมกันในถ้วยเตรียมไว้ก่อนผัด',
          'ขั้นตอน: (1) โขลกกระเทียมกับพริกขี้หนูในครกให้แตกหยาบ ๆ (2) ตั้งกระทะไฟแรงจนน้ำมันร้อนจัด ใส่กระเทียมพริกที่โขลกลงผัดสัก 30 วินาที-1 นาทีจนหอม (3) ใส่หมูสับ ปล่อยให้ติดกระทะเซียนไฟประมาณ 20 วินาทีก่อนค่อยคนให้กระจาย จะได้กลิ่นไหม้หอม ๆ ติดกระทะ (4) ผัดหมูจนเกือบสุก ใส่ถั่วฝักยาวถ้าใช้ แล้วราดซอสปรุงรสที่ผสมไว้ ผัดให้เข้ากัน (5) ปิดไฟทันที ใส่ใบกะเพราลงคลุกให้ทั่ว ความร้อนที่เหลือจะทำให้ใบสลดพอดีโดยไม่เสียกลิ่นหอม (6) ทอดไข่ดาวแยกในกระทะน้ำมันร้อนจัด ใช้ตะหลิวช้อนน้ำมันร้อนราดหน้าไข่ให้ไข่แดงสุกด้านบนขณะที่ขอบไข่ขาวกรอบ เสิร์ฟบนข้าวสวยร้อน ราดกะเพราแล้ววางไข่ดาวด้านบน',
          'เคล็ดลับ: การปล่อยหมูให้เซียนไฟก่อนคนคือกุญแจของกลิ่น "ผัดกะทะ" แบบร้านตามสั่ง ถ้าคนทันทีเนื้อจะแค่สุกแบบต้มไม่มีกลิ่นไหม้หอม'
        ],
        [
          'Pad Kra Pao is Thailand\'s most popular single-plate dish. Its soul is "kra pao" (Holy Basil), which has a sharp, peppery, clove-like aroma — quite different from "horapa" (Thai Basil), which is milder and more anise-like. Never substitute one for the other if you want the authentic flavor.',
          'Ingredients (serves 1-2): 200g ground pork, 1 handful holy basil leaves, 5-6 cloves garlic, 5-10 Thai chilies, cut long beans (optional), 1-2 eggs for frying, oil for frying the egg, oil for stir-frying.',
          'Sauce: 1 tbsp fish sauce, 1 tbsp light soy sauce, 1 tbsp oyster sauce, 1 tsp sugar — mix together in a bowl before cooking.',
          'Steps: (1) Pound garlic and chilies in a mortar until roughly broken down. (2) Heat a wok on high until the oil is very hot, add the pounded garlic and chilies, stir-fry for 30 seconds to 1 minute until fragrant. (3) Add the ground pork, let it sear against the hot wok for about 20 seconds before breaking it up — this gives it a fragrant charred aroma. (4) Stir-fry the pork until nearly cooked, add long beans if using, then pour in the mixed sauce and toss to combine. (5) Turn off the heat immediately and add the holy basil, tossing to wilt it in the residual heat without losing its fresh aroma. (6) Fry the egg separately in very hot oil, basting hot oil over the top with a spatula so the yolk cooks on top while the edges stay crispy. Serve over hot rice, topped with the kra pao and the fried egg.',
          'Tip: letting the pork sear before stirring is the key to that "wok-fried" street-stall aroma — stirring immediately just steams the meat with no charred fragrance.'
        ],
        svgFlowSteps([
          { title: 'โขลกพริก+กระเทียม', sub: 'Pound aromatics', color: '#16A34A' },
          { title: 'ผัดหอมไฟแรง', sub: 'Fry aromatics', color: '#F59E0B' },
          { title: 'เซียนหมู', sub: 'Sear pork', color: '#EA580C' },
          { title: 'ใส่ซอส', sub: 'Add sauce', color: '#DC2626' },
          { title: 'ใส่กะเพราปิดไฟ', sub: 'Basil off-heat', color: '#16A34A' },
          { title: 'ทอดไข่ดาว', sub: 'Fry egg', color: '#0EA5E9' }
        ], 'pad kra pao cooking process flow diagram'))
    ]
  }
];

function trackById(id) { for (var i = 0; i < TRACKS.length; i++) if (TRACKS[i].id === id) return TRACKS[i]; return TRACKS[0]; }
function progressKey(trackId, itemIndex) { return trackId + '::' + itemIndex; }
function loadProgress() { try { return JSON.parse(localStorage.getItem('tanot:cooking:progress')) || {}; } catch (e) { return {}; } }
function saveProgress(p) { try { localStorage.setItem('tanot:cooking:progress', JSON.stringify(p)); } catch (e) {} }
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
   บันทึกส่วนตัวต่อบทเรียน (Notes) — เก็บ localStorage คีย์เดียวกับรูปแบบ progress
   ══════════════════════════════════════════════════════════════════ */
function loadNotes() { try { return JSON.parse(localStorage.getItem('tanot:cooking:notes')) || {}; } catch (e) { return {}; } }
function saveNoteFor(trackId, itemIndex, text) {
  try {
    var notes = loadNotes();
    var key = progressKey(trackId, itemIndex);
    if (text) notes[key] = text; else delete notes[key];
    localStorage.setItem('tanot:cooking:notes', JSON.stringify(notes));
  } catch (e) {}
}
function noteFor(trackId, itemIndex) { return loadNotes()[progressKey(trackId, itemIndex)] || ''; }

/* ══════════════════════════════════════════════════════════════════
   เครื่องมือแปลงหน่วยตวง — ปริมาตร/น้ำหนัก(โดยประมาณ)/อุณหภูมิ
   ══════════════════════════════════════════════════════════════════ */
var VOLUME_TO_ML = { ml: 1, l: 1000, tsp: 5, tbsp: 15, cup: 240, floz: 29.5735 };
var WEIGHT_TO_G = { g: 1, kg: 1000, oz: 28.3495, lb: 453.592 };
function convertVolume(val, from, to) { return (val * VOLUME_TO_ML[from]) / VOLUME_TO_ML[to]; }
function convertWeight(val, from, to) { return (val * WEIGHT_TO_G[from]) / WEIGHT_TO_G[to]; }
function convertTemp(val, from) { return from === 'c' ? (val * 9 / 5 + 32) : ((val - 32) * 5 / 9); }

function unitConverterHtml() {
  var volOpts = ['ml', 'l', 'tsp', 'tbsp', 'cup', 'floz'];
  var wOpts = ['g', 'kg', 'oz', 'lb'];
  function opts(list, sel) { return list.map(function (u) { return '<option value="' + u + '"' + (u === sel ? ' selected' : '') + '>' + u + '</option>'; }).join(''); }
  return '<div class="ck-conv">' +
    '<div class="ck-conv-title">' + t('convTitle') + '</div>' +
    '<div class="ck-conv-row"><span class="ck-conv-label">' + t('convVolume') + '</span>' +
    '<input type="number" id="convVolIn" class="ck-conv-input" value="1" step="any">' +
    '<select id="convVolFrom" class="ck-conv-select">' + opts(volOpts, 'cup') + '</select>' +
    '<span class="ck-conv-eq">=</span>' +
    '<span id="convVolOut" class="ck-conv-out">240</span>' +
    '<select id="convVolTo" class="ck-conv-select">' + opts(volOpts, 'ml') + '</select></div>' +
    '<div class="ck-conv-row"><span class="ck-conv-label">' + t('convWeight') + '</span>' +
    '<input type="number" id="convWIn" class="ck-conv-input" value="1" step="any">' +
    '<select id="convWFrom" class="ck-conv-select">' + opts(wOpts, 'cup' === 'cup' ? 'g' : 'g') + '</select>' +
    '<span class="ck-conv-eq">=</span>' +
    '<span id="convWOut" class="ck-conv-out">0.035</span>' +
    '<select id="convWTo" class="ck-conv-select">' + opts(wOpts, 'oz') + '</select></div>' +
    '<div class="ck-conv-row"><span class="ck-conv-label">' + t('convTemp') + '</span>' +
    '<input type="number" id="convTIn" class="ck-conv-input" value="180" step="any">' +
    '<span class="ck-conv-unit-fixed">°C</span>' +
    '<span class="ck-conv-eq">=</span>' +
    '<span id="convTOut" class="ck-conv-out">356</span>' +
    '<span class="ck-conv-unit-fixed">°F</span></div>' +
    '</div>';
}
function wireUnitConverter(root) {
  var volIn = root.querySelector('#convVolIn'), volFrom = root.querySelector('#convVolFrom'), volTo = root.querySelector('#convVolTo'), volOut = root.querySelector('#convVolOut');
  var wIn = root.querySelector('#convWIn'), wFrom = root.querySelector('#convWFrom'), wTo = root.querySelector('#convWTo'), wOut = root.querySelector('#convWOut');
  var tIn = root.querySelector('#convTIn'), tOut = root.querySelector('#convTOut');
  function fmt(n) { return (Math.round(n * 1000) / 1000).toString(); }
  function updVol() { if (volIn && volOut) volOut.textContent = fmt(convertVolume(parseFloat(volIn.value) || 0, volFrom.value, volTo.value)); }
  function updW() { if (wIn && wOut) wOut.textContent = fmt(convertWeight(parseFloat(wIn.value) || 0, wFrom.value, wTo.value)); }
  function updT() { if (tIn && tOut) tOut.textContent = fmt(convertTemp(parseFloat(tIn.value) || 0, 'c')); }
  [volIn, volFrom, volTo].forEach(function (el) { if (el) el.addEventListener('input', updVol); });
  [wIn, wFrom, wTo].forEach(function (el) { if (el) el.addEventListener('input', updW); });
  if (tIn) tIn.addEventListener('input', updT);
  updVol(); updW(); updT();
}

/* ══════════════════════════════════════════════════════════════════
   ตัวจับเวลา (Timer) — นับถอยหลัง + เสียงเตือนด้วย Web Audio API (ไม่ใช้ไฟล์เสียงภายนอก)
   ══════════════════════════════════════════════════════════════════ */
function beep() {
  try {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    var ctx = new Ctx();
    for (var i = 0; i < 3; i++) {
      var osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = 880;
      osc.connect(gain); gain.connect(ctx.destination);
      var start = ctx.currentTime + i * 0.35;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
      osc.start(start); osc.stop(start + 0.3);
    }
  } catch (e) {}
}
var timerRegistry = {};
function timerWidgetHtml(id, presetMin, labelTh, labelEn) {
  return '<div class="ck-timer" data-timer-id="' + id + '" data-preset="' + presetMin + '">' +
    '<span class="ck-timer-label">⏱ ' + (getUILang() === 'en' ? labelEn : labelTh) + '</span>' +
    '<span class="ck-timer-display" id="tmDisp-' + id + '">' + String(presetMin).padStart(2, '0') + ':00</span>' +
    '<button type="button" class="ck-timer-btn" data-act="start" data-timer="' + id + '">' + t('timerStart') + '</button>' +
    '<button type="button" class="ck-timer-btn" data-act="reset" data-timer="' + id + '">' + t('timerReset') + '</button>' +
    '</div>';
}
function wireTimers(root) {
  root.querySelectorAll('.ck-timer').forEach(function (box) {
    var id = box.getAttribute('data-timer-id');
    var preset = parseFloat(box.getAttribute('data-preset')) * 60;
    if (!timerRegistry[id]) timerRegistry[id] = { remaining: preset, running: false, handle: null };
    var st = timerRegistry[id];
    var disp = box.querySelector('.ck-timer-display');
    var startBtn = box.querySelector('[data-act="start"]');
    function render() {
      var m = Math.floor(st.remaining / 60), s = Math.floor(st.remaining % 60);
      if (disp) disp.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
      if (startBtn) startBtn.textContent = st.running ? t('timerPause') : t('timerStart');
    }
    render();
    box.querySelectorAll('.ck-timer-btn').forEach(function (btn) {
      btn.onclick = function () {
        var act = btn.getAttribute('data-act');
        if (act === 'reset') {
          clearInterval(st.handle); st.running = false; st.remaining = preset; render(); return;
        }
        if (st.running) {
          clearInterval(st.handle); st.running = false; render(); return;
        }
        st.running = true; render();
        st.handle = setInterval(function () {
          st.remaining -= 1;
          if (st.remaining <= 0) {
            st.remaining = 0; st.running = false; clearInterval(st.handle); render(); beep();
            if (disp) { disp.textContent = t('timerDone'); setTimeout(render, 2200); }
          } else render();
        }, 1000);
      };
    });
  });
}

/* ══════════════════════════════════════════════════════════════════
   Gamification — เลเวล/XP/สตรีค/เหรียญตรา (ก็อปจาก sports.js)
   ══════════════════════════════════════════════════════════════════ */
var XP_KEY = 'tanot:cooking:xp';
var STREAK_KEY = 'tanot:cooking:streak';
var BADGES_KEY = 'tanot:cooking:badges';
var XP_PER_EXERCISE = 20;
var XP_PER_TRACK_BONUS = 50;
var XP_PER_LEVEL = 50;

function loadXp() { try { return parseInt(localStorage.getItem(XP_KEY), 10) || 0; } catch (e) { return 0; } }
function saveXp(xp) { try { localStorage.setItem(XP_KEY, String(xp)); } catch (e) {} }
function levelFromXp(xp) { return 1 + Math.floor(xp / XP_PER_LEVEL); }
function xpIntoLevel(xp) { return xp % XP_PER_LEVEL; }
function levelTitle(level) {
  var th = ['มือใหม่หัดครัว', 'ลูกมือครัว', 'ผู้ช่วยกุ๊ก', 'กุ๊กฝีมือดี', 'เชฟมือโปร', 'ปรมาจารย์ครัว'];
  var en = ['Kitchen Newbie', 'Kitchen Helper', 'Cook\'s Assistant', 'Skilled Cook', 'Pro Chef', 'Kitchen Master'];
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
  { id: 'first-pass', icon: '🥉', th: 'ก้าวแรกในครัว', en: 'First Step' },
  { id: 'track-kitchen-basics', icon: '🔪', th: 'เจ้าพื้นฐานครัว', en: 'Kitchen Fundamentals Master' },
  { id: 'track-thai-recipes', icon: '🇹🇭', th: 'เจ้าตำรับอาหารไทย', en: 'Thai Recipes Master' },
  { id: 'streak-3', icon: '🔥', th: 'ขยัน 3 วันติด', en: '3-Day Streak' },
  { id: 'streak-7', icon: '🔥', th: 'สัปดาห์นักครัว', en: '7-Day Streak' },
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
if (typeof document !== 'undefined' && document.getElementById('cookingRoot')) {
  var $ = function (id) { return document.getElementById(id); };
  var trackMenuBtn = $('trackMenuBtn'), trackMenuPanel = $('trackMenuPanel'), currentTrackLabel = $('currentTrackLabel'),
      itemList = $('itemList'), lockMsg = $('lockMsg'), instructionsBox = $('instructionsBox'),
      itemHeading = $('itemHeading'), langToggle = $('langToggle'),
      markReadBtn = $('markReadBtn'), resultBanner = $('resultBanner'),
      levelNumEl = $('levelNum'), levelTitleEl = $('levelTitleEl'), xpFillEl = $('xpFill'),
      streakCountEl = $('streakCount'), badgeRowEl = $('badgeRow'), toastWrap = $('toastWrap'),
      confettiLayer = $('confettiLayer'), speakBtn = $('speakBtn'), stepModeBtn = $('stepModeBtn'),
      stepNav = $('stepNav'), stepPrevBtn = $('stepPrevBtn'), stepNextBtn = $('stepNextBtn'), stepOfEl = $('stepOfEl'),
      notesBox = $('notesBox'), notesSavedEl = $('notesSavedEl'), convBtn = $('convBtn'), convPanel = $('convPanel');

  var state = { trackId: TRACKS[0].id, itemIndex: 0, stepMode: false, stepIdx: 0 };

  function applyI18n() {
    document.documentElement.lang = getUILang();
    document.title = t('pageTitle') + ' | Tanot';
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    if (langToggle) {
      langToggle.querySelectorAll('span').forEach(function (span) {
        span.classList.toggle('active', span.getAttribute('data-lt') === getUILang());
      });
    }
    if (notesBox) notesBox.placeholder = t('notesPlaceholder');
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
        b.className = 'ck-badge' + (earned.indexOf(def.id) !== -1 ? ' earned' : '');
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
    el.className = 'ck-toast';
    el.textContent = item.icon + ' ' + item.text;
    if (toastWrap) toastWrap.appendChild(el);
    setTimeout(function () {
      el.classList.add('leaving');
      setTimeout(function () { el.remove(); processToastQueue(); }, 300);
    }, 2200);
  }

  var CONFETTI_COLORS = ['#EA580C', '#DC2626', '#F59E0B', '#16A34A', '#0EA5E9'];
  function spawnConfetti() {
    if (!confettiLayer) return;
    confettiLayer.innerHTML = '';
    for (var i = 0; i < 18; i++) {
      var piece = document.createElement('span');
      piece.className = 'ck-confetti-piece';
      piece.style.left = Math.round(Math.random() * 100) + '%';
      piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      piece.style.animationDuration = (900 + Math.random() * 700) + 'ms';
      piece.style.animationDelay = Math.round(Math.random() * 200) + 'ms';
      confettiLayer.appendChild(piece);
    }
  }

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
        groupEl.className = 'ck-track-group-label';
        groupEl.textContent = groupText;
        trackMenuPanel.appendChild(groupEl);
        lastGroup = groupText;
      }
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ck-track-menu-item' + (tr.id === state.trackId ? ' active' : '');
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
  if (trackMenuBtn) trackMenuBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleTrackMenu(); });
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
      btn.className = 'ck-item' + (i === state.itemIndex ? ' active' : '') + (unlocked ? '' : ' locked');
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

  /* อ่านออกเสียง (TTS) — ใช้ Web Speech API แบบเดียวกับ languages.html */
  function speak(text, langCode) {
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = langCode;
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }
  function currentBodyText() {
    var track = trackById(state.trackId);
    var item = track.items[state.itemIndex];
    return pick(item.body).join(' ');
  }
  if (speakBtn) {
    speakBtn.addEventListener('click', function () {
      speak(currentBodyText(), getUILang() === 'en' ? 'en-US' : 'th-TH');
      speakBtn.textContent = t('speakingBtn');
      setTimeout(function () { speakBtn.textContent = t('speakBtn'); }, 1400);
    });
  }

  /* โหมดดูทีละขั้นตอน — สลับการแสดงย่อหน้าทั้งหมด vs ทีละย่อหน้า */
  function renderStepMode() {
    var track = trackById(state.trackId);
    var item = track.items[state.itemIndex];
    var paras = pick(item.body);
    if (state.stepMode) {
      instructionsBox.innerHTML = '<p>' + paras[state.stepIdx] + '</p>';
      if (state.stepIdx === paras.length - 1 && item.diagram) instructionsBox.innerHTML += item.diagram;
      if (stepNav) stepNav.style.display = 'flex';
      if (stepOfEl) stepOfEl.textContent = t('stepOf', { n: state.stepIdx + 1, total: paras.length });
      if (stepPrevBtn) stepPrevBtn.disabled = state.stepIdx === 0;
      if (stepNextBtn) stepNextBtn.disabled = state.stepIdx === paras.length - 1;
    } else {
      instructionsBox.innerHTML = paras.map(function (p) { return '<p>' + p + '</p>'; }).join('');
      if (item.diagram) instructionsBox.innerHTML += item.diagram;
      if (stepNav) stepNav.style.display = 'none';
    }
    if (item.diagram && item.diagram.indexOf('unitConvWidget') !== -1) {
      var mount = document.getElementById('unitConvWidget');
      if (mount) { mount.innerHTML = unitConverterHtml(); wireUnitConverter(mount); }
    }
    wireTimers(instructionsBox);
  }
  if (stepModeBtn) {
    stepModeBtn.addEventListener('click', function () {
      state.stepMode = !state.stepMode;
      state.stepIdx = 0;
      stepModeBtn.textContent = state.stepMode ? t('stepModeOff') : t('stepModeOn');
      renderStepMode();
    });
  }
  if (stepPrevBtn) stepPrevBtn.addEventListener('click', function () { if (state.stepIdx > 0) { state.stepIdx--; renderStepMode(); } });
  if (stepNextBtn) stepNextBtn.addEventListener('click', function () {
    var track = trackById(state.trackId);
    var paras = pick(track.items[state.itemIndex].body);
    if (state.stepIdx < paras.length - 1) { state.stepIdx++; renderStepMode(); }
  });

  /* บันทึกส่วนตัว — auto-save แบบ debounce */
  var noteSaveTimer = null;
  if (notesBox) {
    notesBox.addEventListener('input', function () {
      clearTimeout(noteSaveTimer);
      noteSaveTimer = setTimeout(function () {
        saveNoteFor(state.trackId, state.itemIndex, notesBox.value);
        if (notesSavedEl) {
          notesSavedEl.textContent = t('notesSaved');
          notesSavedEl.style.opacity = '1';
          setTimeout(function () { notesSavedEl.style.opacity = '0'; }, 1400);
        }
      }, 500);
    });
  }

  /* ตัวแปลงหน่วยตวง — แผงลอยเปิด/ปิดได้จากทุกบทเรียน */
  if (convBtn && convPanel) {
    convBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = convPanel.classList.toggle('open');
      if (open && !convPanel.dataset.wired) {
        convPanel.innerHTML = unitConverterHtml();
        wireUnitConverter(convPanel);
        convPanel.dataset.wired = '1';
      }
    });
    convPanel.addEventListener('click', function (e) { e.stopPropagation(); });
    document.addEventListener('click', function () { convPanel.classList.remove('open'); });
  }

  function selectItem(idx) {
    state.itemIndex = idx;
    state.stepMode = false;
    state.stepIdx = 0;
    if (stepModeBtn) stepModeBtn.textContent = t('stepModeOn');
    renderItemList();
    var track = trackById(state.trackId);
    var item = track.items[idx];

    resultBanner.style.display = 'none';
    resultBanner.className = 'ck-result-banner';

    itemHeading.textContent = pick(item.heading);
    renderStepMode();
    markReadBtn.style.display = 'inline-flex';
    markReadBtn.disabled = false;
    if (notesBox) notesBox.value = noteFor(state.trackId, idx);

    var progress = loadProgress();
    var isLastOfTrack = idx === track.items.length - 1;
    var alreadyPassed = !!progress[progressKey(track.id, idx)];
    if (alreadyPassed && isLastOfTrack && trackCompleted(track, progress)) {
      resultBanner.textContent = t('trackDoneMsg');
      resultBanner.className = 'ck-result-banner pass';
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
        resultBanner.className = 'ck-result-banner pass';
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
