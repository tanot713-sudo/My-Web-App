/* lang-calc.js — ตรรกะล้วนของหน้า languages (ไม่มี DOM/storage; UMD window.LangCalc; require() ได้ใน test)
 * L5 สวมบทบาท: SCENES (8 ฉาก = หมวดวลีเดิม), roleplayMessages, parseRoleplay, summaryMessages/parseSummary, userCardKey
 * งานถัดไป (L1/L2…) เพิ่มฟังก์ชันของตัวเองในไฟล์นี้ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LangCalc = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LEVELS = ['A1', 'A2', 'B1', 'B2'];
  // cat = ชื่อหมวดใน lang-data.phrases (ตรงตัว) · role = บทบาทของ AI (ภาษาอังกฤษ ใช้ใน prompt) · goal = เป้าของผู้เรียน (ไทย แสดงในฉาก)
  var SCENES = [
    { id: 'greet', cat: 'ทักทายและแนะนำตัว', th: 'ทักทายและแนะนำตัว', en: 'Greetings and introductions', role: 'a friendly person meeting the learner for the first time', goal: 'ทักทาย แนะนำตัว และถามไถ่อีกฝ่าย', goalEn: 'Greet, introduce yourself and ask about them' },
    { id: 'restaurant', cat: 'การเดินทางและร้านอาหาร', th: 'ร้านอาหารและการเดินทาง', en: 'Restaurant and getting around', role: 'a waiter at a restaurant', goal: 'สั่งอาหาร ถามราคา และขอบิล', goalEn: 'Order food, ask prices and ask for the bill' },
    { id: 'interview', cat: 'การทำงานและสัมภาษณ์งาน', th: 'สัมภาษณ์งาน', en: 'Job interview', role: 'an interviewer at a company', goal: 'แนะนำประสบการณ์และตอบคำถามสัมภาษณ์', goalEn: 'Describe your experience and answer interview questions' },
    { id: 'immigration', cat: 'เดินทางเข้าประเทศ', th: 'ตรวจคนเข้าเมือง', en: 'Immigration desk', role: 'an immigration officer at the airport', goal: 'ตอบวัตถุประสงค์การเดินทางและที่พัก', goalEn: 'Explain your trip and where you will stay' },
    { id: 'housing', cat: 'หาที่พักและเช่าบ้าน', th: 'เช่าที่พัก', en: 'Renting a home', role: 'a landlord showing a rental room', goal: 'ถามค่าเช่า เงินมัดจำ และเงื่อนไขสัญญา', goalEn: 'Ask about rent, deposit and contract terms' },
    { id: 'bank', cat: 'ธนาคารและซิมโทรศัพท์', th: 'ธนาคารและซิมโทรศัพท์', en: 'Bank and SIM card', role: 'a bank or phone shop clerk', goal: 'เปิดบัญชีหรือสมัครซิมโทรศัพท์', goalEn: 'Open an account or get a SIM card' },
    { id: 'shopping', cat: 'ชีวิตประจำวันและซื้อของ', th: 'ซื้อของ', en: 'Shopping', role: 'a shop assistant', goal: 'ถามราคา ต่อรอง และจ่ายเงิน', goalEn: 'Ask prices, bargain and pay' },
    { id: 'hospital', cat: 'โรงพยาบาลและเหตุฉุกเฉิน', th: 'โรงพยาบาล', en: 'At the hospital', role: 'a doctor or nurse at a hospital', goal: 'บอกอาการและตอบคำถามของแพทย์', goalEn: 'Describe symptoms and answer the doctor' }
  ];

  function sceneOf(id) {
    for (var i = 0; i < SCENES.length; i++) if (SCENES[i].id === id) return SCENES[i];
    throw new Error('unknown scene: ' + id);
  }
  function levelOf(level) { return LEVELS.indexOf(level) >= 0 ? level : 'A1'; }

  var FORMAT = 'ท้ายคำตอบทุกครั้งให้ต่อด้วยบรรทัดใหม่ที่เป็น JSON บรรทัดเดียวเท่านั้น: {"fix": "...", "th": "..."} ' +
    '— "fix" = ประโยคล่าสุดของผู้เรียนที่แก้ให้ถูก (ถ้าถูกแล้วหรือยังไม่มีประโยคของผู้เรียนให้เป็น "") · "th" = คำแปลไทยของคำตอบที่คุณเพิ่งพูด · ห้ามใส่ข้อความอื่นหลัง JSON';

  function roleplayMessages(sceneId, level, langName, history) {
    var s = sceneOf(sceneId), lv = levelOf(level);
    var sys = 'You are role-playing ' + s.role + '. Scene: ' + s.en + '. The learner (a Thai speaker) practises ' + langName + ' at CEFR level ' + lv + '.\n' +
      'พูดเป็นภาษา' + langName + ' ระดับ ' + lv + ' เท่านั้น ใช้คำและไวยากรณ์ที่ระดับนี้เข้าใจได้ ตอบสั้นไม่เกิน 2 ประโยค แล้วถามหรือชวนให้ผู้เรียนพูดต่อ อยู่ในบทบาทตลอด\n' +
      'เป้าของผู้เรียนในฉากนี้: ' + s.goal + '\n' + FORMAT;
    var msgs = [{ role: 'system', content: sys }];
    var h = Array.isArray(history) ? history : [];
    if (!h.length) msgs.push({ role: 'user', content: '(เริ่มฉาก — คุณพูดประโยคเปิดก่อน)' });
    else h.forEach(function (m) { if (m && (m.role === 'user' || m.role === 'assistant')) msgs.push({ role: m.role, content: String(m.content || '') }); });
    return msgs;
  }

  // แยกข้อความกับ JSON ท้ายคำตอบ · ไม่มี JSON = ข้อความล้วน · JSON ที่ยังไม่ครบ (กำลัง stream) = ซ่อนส่วนท้าย
  function parseRoleplay(raw) {
    var s = String(raw == null ? '' : raw).replace(/```(?:json)?/gi, '');
    var i = s.lastIndexOf('{');
    if (i >= 0) {
      var tail = s.slice(i).trim();
      try {
        var o = JSON.parse(tail);
        if (o && typeof o === 'object' && ('fix' in o || 'th' in o)) {
          return { text: s.slice(0, i).trim(), fix: String(o.fix || ''), th: String(o.th || '') };
        }
      } catch (e) {
        if (/^\{\s*"(?:fix|th)"/.test(tail)) return { text: s.slice(0, i).trim(), fix: '', th: '' };
      }
    }
    return { text: s.trim(), fix: '', th: '' };
  }

  function summaryMessages(sceneId, level, langName, history) {
    var s = sceneOf(sceneId);
    var sys = 'จากบทสนทนาฉาก "' + s.en + '" ภาษา' + langName + ' ระดับ ' + levelOf(level) + ' ด้านล่าง เลือกคำหรือวลีสั้นที่ผู้เรียนควรจำ ไม่เกิน 5 รายการ ' +
      'ตอบเป็น JSON บรรทัดเดียวเท่านั้น: {"words": [{"word": "คำในภาษา' + langName + '", "thai": "คำแปลไทย"}]} ห้ามมีข้อความอื่น';
    var convo = (history || []).map(function (m) { return (m.role === 'user' ? 'Learner: ' : 'Partner: ') + m.content; }).join('\n');
    return [{ role: 'system', content: sys }, { role: 'user', content: convo || '(ไม่มีบทสนทนา)' }];
  }

  function norm(w) { return String(w || '').replace(/\s+/g, ' ').trim(); }
  function userCardKey(langId, word) {
    var lemma = norm(word).toLowerCase().replace(/^[\s.,!?;:"'()\[\]{}¿¡…。、！？「」]+|[\s.,!?;:"'()\[\]{}¿¡…。、！？「」]+$/g, '');
    return lemma ? langId + '::u::' + lemma : '';
  }

  function parseSummary(raw) {
    var s = String(raw == null ? '' : raw).replace(/```(?:json)?/gi, '');
    var a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b <= a) return [];
    var o;
    try { o = JSON.parse(s.slice(a, b + 1)); } catch (e) { return []; }
    var list = o && Array.isArray(o.words) ? o.words : [], seen = {}, out = [];
    list.forEach(function (x) {
      var w = norm(x && x.word), k = w.toLowerCase();
      if (!w || seen[k] || out.length >= 5) return;
      seen[k] = 1;
      out.push({ word: w.slice(0, 80), thai: norm(x.thai).slice(0, 120) });
    });
    return out;
  }

  return { LEVELS: LEVELS, SCENES: SCENES, sceneOf: sceneOf, roleplayMessages: roleplayMessages, parseRoleplay: parseRoleplay, summaryMessages: summaryMessages, parseSummary: parseSummary, userCardKey: userCardKey };
}));
