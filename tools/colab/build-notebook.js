#!/usr/bin/env node
/* สร้าง tools/colab/tanot-audiobook-f5.ipynb จาก tanot_audiobook_f5.py (ไม่มี dependency — node อย่างเดียว)
   • cell markdown สั้นๆ (ภาษาไทย) + cell โค้ดเดียว = ทั้งไฟล์ .py ทุกตัวอักษร · ไม่มี output · metadata เลือก GPU L4 ตามรูปแบบของ Colab
   • แก้ .py แล้วต้องรันซ้ำ: node tools/colab/build-notebook.js · ตรวจอย่างเดียว (ไม่เขียน): --check (tests/colab.spec.js ตรวจแบบเดียวกัน) */
'use strict';
var fs = require('fs');
var path = require('path');

var DIR = __dirname;
var PY = path.join(DIR, 'tanot_audiobook_f5.py');
var NB = path.join(DIR, 'tanot-audiobook-f5.ipynb');

var INTRO = [
  '# Tanot — หนังสือเสียงคุณภาพสูง (F5-TTS-THAI)',
  '',
  'สร้างหนังสือเสียงภาษาไทยจากไฟล์ .txt ด้วย F5-TTS-THAI → MP3 แยกตามตอน เก็บใน Google Drive',
  '',
  '1. **เลือก L4 GPU ก่อน**: Runtime → Change runtime type → L4 GPU → Save',
  '2. กด **Run** ที่ cell ด้านล่าง',
  '3. อนุญาตให้เข้าถึง Google Drive แล้วอัปโหลดไฟล์ .txt (ครั้งแรกอัปโหลด ref-F-C.wav + ref-M-C.wav ด้วย)',
  '4. ไฟล์ MP3 อยู่ที่ **My Drive/Tanot หนังสือเสียง/<ชื่อเรื่อง>/** — เปิดแท็บนี้ค้างไว้ หลุดแล้วกด Run ใหม่จะทำต่อจากตอนที่ค้าง',
  '',
  'ใช้เสียงตัวอย่างที่สร้างเอง/ได้รับอนุญาตเท่านั้น'
].join('\n');

/* แบ่งเป็นบรรทัดแบบ Jupyter (ทุกบรรทัดลงท้าย \n ยกเว้นบรรทัดสุดท้ายถ้าไฟล์ไม่ได้จบด้วย \n) — join('') ได้ข้อความเดิมทุกตัวอักษร */
function lines(s) {
  var out = [], re = /[^\n]*\n|[^\n]+$/g, m;
  while ((m = re.exec(s))) out.push(m[0]);
  return out;
}

function build(py) {
  var nb = {
    nbformat: 4,
    nbformat_minor: 0,
    metadata: {
      colab: { provenance: [], gpuType: 'L4', name: 'tanot-audiobook-f5.ipynb' },
      kernelspec: { name: 'python3', display_name: 'Python 3' },
      language_info: { name: 'python' },
      accelerator: 'GPU'
    },
    cells: [
      { cell_type: 'markdown', metadata: { id: 'tanot-intro' }, source: lines(INTRO) },
      { cell_type: 'code', execution_count: null, metadata: { id: 'tanot-run' }, outputs: [], source: lines(py) }
    ]
  };
  return JSON.stringify(nb, null, 1) + '\n';
}

if (require.main === module) {
  var want = build(fs.readFileSync(PY, 'utf8'));
  if (process.argv.indexOf('--check') >= 0) {
    var have = fs.existsSync(NB) ? fs.readFileSync(NB, 'utf8') : '';
    if (have !== want) { console.error('tanot-audiobook-f5.ipynb ไม่ตรงกับ tanot_audiobook_f5.py — รัน node tools/colab/build-notebook.js'); process.exit(1); }
    console.log('ok');
  } else {
    fs.writeFileSync(NB, want);
    console.log('เขียน ' + path.relative(process.cwd(), NB));
  }
}

module.exports = { build: build, lines: lines, PY: PY, NB: NB };
