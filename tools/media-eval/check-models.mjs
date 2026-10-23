// ตรวจกับ Hugging Face จริงว่า repo/ไฟล์ dtype ของ Whisper ทุกรายการใน media-models.js ที่เป็นของ Tanotfin (Thonburian small/medium) และเสียงพูด Jori/Riko (ไฟล์ fp32 สำหรับ WebGPU + WASM ที่ commit ที่ล็อกไว้) มีครบ — รันในเครื่องเจ้าของที่ออกเน็ตได้
// (sandbox ที่เขียนโค้ดรอบ Section 3 เข้า huggingface.co ไม่ได้ จึงตรวจเองไม่ได้ → ต้องรันสคริปต์นี้ก่อนเชื่อว่ารายการใช้ได้จริง)
//   node tools/media-eval/check-models.mjs            → ตาราง repo × (ไฟล์ที่ต้องใช้) · exit 1 ถ้ามีอะไรขาด
//   HF_TOKEN=hf_xxx node …                           → จำเป็นเมื่อ repo ของ Tanotfin เป็น private (token แบบ Read) + กัน rate limit · ห้ามเขียนโทเคนลงไฟล์
//   node tools/media-eval/check-models.mjs --paddle  → เฉพาะโมเดลของ "อ่านแบบใหม่" (PaddleOCR — repo ทางการ PaddlePaddle/*_onnx, public ไม่ต้องมี token):
//                                                     มีไฟล์ครบที่ revision ในตาราง + ขนาดจริง + commit ล่าสุดของ main
//   node tools/media-eval/check-models.mjs --paddle --pin → เขียน commit ล่าสุดของแต่ละ repo ลง ocr-paddle-calc.js (MODELS[].revision) แล้ว commit + bump CACHE ใน sw.js
// กฎชื่อไฟล์ของ transformers.js: onnx/<ส่วนประกอบ><คำต่อท้ายของ dtype>.onnx · fp32 '' · fp16 _fp16 · q8 _quantized · int8 _int8 · uint8 _uint8 · q4 _q4 · bnb4 _bnb4
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SUFFIX = { fp32: '', fp16: '_fp16', q8: '_quantized', int8: '_int8', uint8: '_uint8', q4: '_q4', bnb4: '_bnb4' };
const CONFIGS = ['config.json', 'generation_config.json', 'preprocessor_config.json', 'tokenizer.json'];

const sandbox = { self: {} };
vm.runInNewContext(await readFile(join(ROOT, 'media-models.js'), 'utf8'), sandbox);
/* ตรวจเฉพาะโมเดลที่เว็บยังโหลดจริงของ Tanotfin: Thonburian small/medium + เสียงพูด Jori/Riko (ไม่มีทางถอยไปเสียงเก่าแล้ว) */
const models = sandbox.self.TanotMediaModels.ASR_MODELS.filter((m) => /^Tanotfin\/distill-whisper-th-(small|medium)-onnx$/.test(m.id));
const headers = process.env.HF_TOKEN ? { Authorization: 'Bearer ' + process.env.HF_TOKEN } : {};

async function files(repo, rev = 'main') {
  const list = async (path) => {
    const res = await fetch('https://huggingface.co/api/models/' + repo + '/tree/' + encodeURIComponent(rev) + (path ? '/' + path : ''), { headers });
    if (res.status === 404) return null;
    if ((res.status === 401 || res.status === 403) && /^Tanotfin\//.test(repo)) throw new Error('HTTP ' + res.status + (process.env.HF_TOKEN ? ' — HF_TOKEN ไม่มีสิทธิ์อ่าน repo นี้' : ' — repo เป็น private: ตั้ง HF_TOKEN (token แบบ Read) ก่อนรัน'));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return (await res.json()).map((f) => (path ? path + '/' : '') + f.path.replace(/^.*\//, ''));
  };
  const root = await list('');
  if (root === null) return null;
  return new Set([...root, ...((await list('onnx')) || [])]);
}

let bad = 0;
const ONLY_PADDLE = process.argv.includes('--paddle'), PIN = process.argv.includes('--pin');
for (const m of ONLY_PADDLE ? [] : models) {
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
  else console.log('✓  ' + m.id + ' (' + [...new Set(need)].length + ' ไฟล์ครบ' + ')');
}
/* เสียงพูด MMS-TTS (Section 5): WASM ใช้ dtype ตาม TTS_DTYPE_OVERRIDES (ไม่มี = q8 → model_quantized.onnx) · WebGPU ใช้ ttsGpuDtype (fp32 → model.onnx) — ไฟล์ fp32 ของแต่ละ repo ยังไม่เคยตรวจจริง */
const M = sandbox.self.TanotMediaModels;
/* เสียงไทย 2 ตัว (Jori / Riko — fp32 เท่านั้น ที่ commit ใน TTS_REVISION) */
const voices = ONLY_PADDLE ? [] : [...M.TTS_VOICE_IDS];
for (const id of voices) {
  const need = ['config.json'];
  for (const d of [M.ttsDtype(id) || 'q8', M.ttsGpuDtype(id)]) need.push('onnx/model' + SUFFIX[d] + '.onnx');
  let have;
  const rev = M.ttsRevision ? M.ttsRevision(id) : 'main';
  try { have = await files(id, rev); } catch (e) { console.log('?? ' + id + '@' + rev + ' — ตรวจไม่ได้: ' + e.message); bad++; continue; }
  if (!have) { console.log('✗  ' + id + '@' + rev + ' — ไม่พบ repo/commit นี้บน Hugging Face'); bad++; continue; }
  const missing = [...new Set(need)].filter((f) => !have.has(f));
  if (missing.length) { console.log('✗  ' + id + '@' + rev + ' (เสียงพูด) — ขาด: ' + missing.join(', ') + (missing.some((f) => f === 'onnx/model.onnx') ? ' · ไม่มี fp32 = WebGPU ถอย WASM เสมอสำหรับเสียงนี้ (ไม่ใช่ข้อผิดพลาดร้ายแรง — ตั้ง TTS_GPU_DTYPE_OVERRIDES หรือยอมรับ)' : '')); bad++; }
  else console.log('✓  ' + id + ' (เสียงพูด ' + [...new Set(need)].length + ' ไฟล์ครบ)');
}
/* PaddleOCR (อ่านแบบใหม่ ทดลอง): ตาราง MODELS ใน ocr-paddle-calc.js — ไฟล์ต้องมีที่ revision ที่ล็อก · ขนาดจริงใช้ใส่ PR/ตาราง (bytes = ค่าประมาณของแถบดาวน์โหลดก่อนรู้ Content-Length) */
if (ONLY_PADDLE) {
  const C = (await import(pathToFileURL(join(ROOT, 'ocr-paddle-calc.js')).href)).default;
  const pins = {};
  for (const [key, m] of Object.entries(C.MODELS)) {
    try {
      const info = await fetch('https://huggingface.co/api/models/' + m.repo, { headers });
      if (!info.ok) { console.log('✗  ' + m.repo + ' — HTTP ' + info.status + ' (ไม่พบ repo)'); bad++; continue; }
      const sha = (await info.json()).sha;
      const tree = await fetch('https://huggingface.co/api/models/' + m.repo + '/tree/' + encodeURIComponent(m.revision), { headers });
      if (!tree.ok) { console.log('✗  ' + m.repo + '@' + m.revision + ' — HTTP ' + tree.status + ' (ไม่พบ revision)'); bad++; continue; }
      const f = (await tree.json()).find((x) => x.path === m.file);
      if (!f) { console.log('✗  ' + m.repo + '@' + m.revision + ' — ไม่มีไฟล์ ' + m.file); bad++; continue; }
      const size = (f.lfs && f.lfs.size) || f.size;
      pins[m.repo] = sha;
      console.log('✓  ' + key.padEnd(6) + m.repo + '/' + m.file + '  ' + (size / 1048576).toFixed(2) + ' MB (' + size + ' ไบต์, ตาราง ' + m.bytes + ')  main=' + sha + (C.isSha(m.revision) ? (m.revision === sha ? '  [ล็อกตรงกับ main]' : '  [ล็อก ' + m.revision.slice(0, 10) + '… — main ใหม่กว่า]') : '  [ยังไม่ล็อก]'));
    } catch (e) { console.log('?? ' + m.repo + ' — ตรวจไม่ได้: ' + e.message); bad++; }
  }
  if (PIN && !bad) {
    const file = join(ROOT, 'ocr-paddle-calc.js');
    let src = await readFile(file, 'utf8');
    for (const [repo, sha] of Object.entries(pins)) {
      src = src.replace(new RegExp("(repo: '" + repo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "', file: '[^']+', revision: ')[^']*(')", 'g'), '$1' + sha + '$2');
    }
    await writeFile(file, src);
    console.log('\nเขียน revision ลง ocr-paddle-calc.js แล้ว — อย่าลืม bump CACHE ใน sw.js');
  } else if (PIN) console.log('\nไม่เขียน revision เพราะมีรายการไม่ผ่าน');
}
console.log(bad ? '\nมี ' + bad + ' รายการไม่ผ่าน — แก้ตารางใน ' + (ONLY_PADDLE ? 'ocr-paddle-calc.js' : 'media-models.js') + ' (หรือถอดตัวนั้นออกจากรายการ) ก่อนปล่อย' : '\nผ่านทั้งหมด');
process.exit(bad ? 1 : 0);
