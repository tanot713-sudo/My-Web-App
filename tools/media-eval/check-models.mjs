// ตรวจกับ Hugging Face จริงว่า repo/ไฟล์ dtype ของ Whisper ทุกรายการใน media-models.js (Xenova, onnx-community และ Thonburian ของ Tanotfin) มีครบ — รันในเครื่องเจ้าของที่ออกเน็ตได้
// (sandbox ที่เขียนโค้ดรอบ Section 3 เข้า huggingface.co ไม่ได้ จึงตรวจเองไม่ได้ → ต้องรันสคริปต์นี้ก่อนเชื่อว่ารายการใช้ได้จริง)
//   node tools/media-eval/check-models.mjs            → ตาราง repo × (ไฟล์ที่ต้องใช้) · exit 1 ถ้ามีอะไรขาด
//   HF_TOKEN=hf_xxx node …                           → (ไม่จำเป็น) กัน rate limit · ห้ามเขียนโทเคนลงไฟล์
// กฎชื่อไฟล์ของ transformers.js: onnx/<ส่วนประกอบ><คำต่อท้ายของ dtype>.onnx · fp32 '' · fp16 _fp16 · q8 _quantized · int8 _int8 · uint8 _uint8 · q4 _q4 · bnb4 _bnb4
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SUFFIX = { fp32: '', fp16: '_fp16', q8: '_quantized', int8: '_int8', uint8: '_uint8', q4: '_q4', bnb4: '_bnb4' };
const CONFIGS = ['config.json', 'generation_config.json', 'preprocessor_config.json', 'tokenizer.json'];

const sandbox = { self: {} };
vm.runInNewContext(await readFile(join(ROOT, 'media-models.js'), 'utf8'), sandbox);
const models = sandbox.self.TanotMediaModels.ASR_MODELS;
const headers = process.env.HF_TOKEN ? { Authorization: 'Bearer ' + process.env.HF_TOKEN } : {};

async function files(repo) {
  const list = async (path) => {
    const res = await fetch('https://huggingface.co/api/models/' + repo + '/tree/main' + (path ? '/' + path : ''), { headers });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return (await res.json()).map((f) => (path ? path + '/' : '') + f.path.replace(/^.*\//, ''));
  };
  const root = await list('');
  if (root === null) return null;
  return new Set([...root, ...((await list('onnx')) || [])]);
}

let bad = 0;
for (const m of models) {
  const need = [...CONFIGS];
  for (const [kind, dt] of [['WebGPU', m.gpu], ['WASM', m.wasm]]) {
    if (!dt) continue;
    for (const [part, d] of Object.entries(dt)) need.push('onnx/' + part + SUFFIX[d] + '.onnx');
  }
  if (!m.gpu && !m.wasm) for (const part of ['encoder_model', 'decoder_model_merged']) need.push('onnx/' + part + SUFFIX.q8 + '.onnx'); // รุ่น Xenova เดิม = dtype เริ่มต้นของ WASM (q8)
  let have;
  try { have = await files(m.id); } catch (e) { console.log('?? ' + m.id + ' — ตรวจไม่ได้: ' + e.message); bad++; continue; }
  if (!have) { console.log('✗  ' + m.id + ' — ไม่พบ repo นี้บน Hugging Face'); bad++; continue; }
  const missing = [...new Set(need)].filter((f) => !have.has(f));
  if (missing.length) { console.log('✗  ' + m.id + ' — ขาด: ' + missing.join(', ')); bad++; }
  else console.log('✓  ' + m.id + ' (' + [...new Set(need)].length + ' ไฟล์ครบ' + (m.legacy ? ', ถอยไป ' + m.legacy : '') + ')');
}
console.log(bad ? '\nมี ' + bad + ' รายการไม่ผ่าน — แก้ตารางใน media-models.js (หรือถอดตัวนั้นออกจากรายการ) ก่อนปล่อย' : '\nผ่านทั้งหมด');
process.exit(bad ? 1 : 0);
