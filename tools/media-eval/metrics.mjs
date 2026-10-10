// ตัววัดความแม่นของการถอดเสียง/OCR เทียบข้อความเฉลย — ไม่มีไลบรารีนอก (Node 20+ มี Intl.Segmenter ภาษาไทยในตัว)
//   CER (character error rate) = ระยะแก้ไขระดับตัวอักษร ÷ จำนวนตัวอักษรของเฉลย — ตัดช่องว่างทิ้งก่อนเทียบ เพราะภาษาไทยไม่เว้นวรรคระหว่างคำ
//       และแต่ละเอนจินเว้นวรรคไม่เหมือนกัน (ถ้าไม่ตัด ช่องว่างที่ต่างกันจะถูกนับเป็นความผิดทั้งที่อ่านถูก)
//   WER (word error rate) = ระยะแก้ไขระดับคำ ÷ จำนวนคำของเฉลย — ตัดคำด้วย Intl.Segmenter('th', { granularity: 'word' })
//       (ตัดไทยปนอังกฤษได้ในตัว) ใช้เฉพาะ segment ที่ isWordLike
// ทั้งคู่ normalize ก่อน: NFC, ตัวพิมพ์เล็ก, ตัดเครื่องหมายวรรคตอน/สัญลักษณ์, เลขไทย → เลขอารบิก, ยุบช่องว่าง
// รัน `node tools/media-eval/metrics.mjs --self-test` เพื่อตรวจตัวอย่างที่รู้คำตอบ

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';

export function normalize(s) {
  return String(s || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)))
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ระยะแก้ไข (Levenshtein) ของอาร์เรย์ 2 ชุด — แถวเดียว O(n·m) เวลา, O(min) หน่วยความจำ */
export function editDistance(a, b) {
  if (a.length < b.length) [a, b] = [b, a];
  if (!b.length) return a.length;
  let prev = new Uint32Array(b.length + 1), cur = new Uint32Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    const ai = a[i - 1];
    for (let j = 1; j <= b.length; j++) {
      const sub = prev[j - 1] + (ai === b[j - 1] ? 0 : 1);
      const del = prev[j] + 1, ins = cur[j - 1] + 1;
      cur[j] = sub < del ? (sub < ins ? sub : ins) : (del < ins ? del : ins);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}

const SEG = new Intl.Segmenter('th', { granularity: 'word' });
export function words(s) {
  const out = [];
  for (const x of SEG.segment(normalize(s))) if (x.isWordLike) out.push(x.segment);
  return out;
}
export function chars(s) { return Array.from(normalize(s).replace(/\s+/g, '')); }

export function cer(ref, hyp) {
  const r = chars(ref), h = chars(hyp);
  return r.length ? editDistance(r, h) / r.length : (h.length ? 1 : 0);
}
export function wer(ref, hyp) {
  const r = words(ref), h = words(hyp);
  return r.length ? editDistance(r, h) / r.length : (h.length ? 1 : 0);
}

if (process.argv.includes('--self-test')) {
  const eq = (name, got, want) => {
    const ok = Math.abs(got - want) < 1e-9;
    console.log((ok ? 'ok   ' : 'FAIL ') + name + ' = ' + got + (ok ? '' : ' (ต้องได้ ' + want + ')'));
    if (!ok) process.exitCode = 1;
  };
  eq('editDistance kitten/sitting', editDistance([...'kitten'], [...'sitting']), 3);
  eq('cer เหมือนกัน (ช่องว่าง/วรรคตอนต่างกัน)', cer('สวัสดี ครับ!', 'สวัสดีครับ'), 0);
  eq('cer ผิด 1 ตัวจาก 10', cer('สวัสดีครับ', 'สวัสดีคราบ'), 1 / 10);
  eq('cer เลขไทย = เลขอารบิก', cer('๑๒๓', '123'), 0);
  eq('wer อังกฤษ ผิด 1 จาก 4', wer('the cat sat down', 'the cat sit down'), 1 / 4);
  eq('wer เฉลยว่าง ผลว่าง', wer('', ''), 0);
  eq('cer ผลว่าง = 1', cer('abc', ''), 1);
}
