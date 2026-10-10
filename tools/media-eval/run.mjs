// ชุดวัดผลถอดเสียง/OCR ของ Tanot (Section 0) — รันในเครื่องเจ้าของเท่านั้น ไม่อยู่ใน CI (เอนจินในเบราว์เซอร์ต้องโหลดโมเดลจาก Hugging Face)
// วิธีใช้/วางไฟล์: ดู README.md ในโฟลเดอร์นี้ · ผลลัพธ์เขียนที่ tools/media-eval/local/results-*.json|md (โฟลเดอร์ local/ ไม่ถูก commit)
//
// เอนจิน (--engines a,b,…; ค่าเริ่มต้น = ทุกตัวที่ใช้ได้):
//   asr:tiny asr:base asr:small asr:medium  — Whisper ในเบราว์เซอร์ ผ่านหน้า text-to-speech.html จริง (เซิร์ฟเวอร์ static ในเครื่อง)
//   asr:gpu-tiny asr:gpu-base asr:gpu-small asr:gpu-large — Whisper รุ่นใหม่ onnx-community บน WebGPU (Section 3) · ต้องมี WebGPU จริงบนเครื่องนี้ (ใช้ --headed
//                                             และเปิดแฟล็ก WebGPU ของ Chromium ให้ — สคริปต์ใส่ให้) · หน้าไม่ได้ใช้ WebGPU จริง (ถอย WASM) = แถวนั้นขึ้น ERROR ไม่นับเป็นผล WebGPU
//   asr:th-small asr:th-medium              — Thonburian Whisper (Tanotfin/distill-whisper-th-*-onnx, Section 3 ข้อ 3) บน WASM ผ่านหน้าเดียวกัน · ใช้ --lang thai (หน้าบังคับ language:'thai' เมื่อเลือกอัตโนมัติอยู่แล้ว)
//   asr:gpu-th-small asr:gpu-th-medium      — Thonburian บน WebGPU จริง (ใช้ --headed เหมือน asr:gpu-*) · medium ต้องมี shader-f16 · เทียบ CER กับ asr:small/asr:medium (Xenova), asr:gpu-small (onnx-community) และ asr:cloud
//   asr:cloud                               — ปุ่มคลาวด์ของหน้าเดียวกันบน pages.dev (ต้องตั้ง MEDIA_EVAL_URL + MEDIA_EVAL_COOKIE) = โหมดใหม่: ท่อนเหลื่อม 1.5 วิ ส่งขนาน ≤ 3 + vad_filter
//   asr:cloud-seq                           — เหมือน asr:cloud แต่ทีละท่อนไม่เหลื่อม (พฤติกรรมก่อน Section 3) ใช้เทียบเวลา/Neurons/CER กับ asr:cloud (--cloud-domain ใส่ชุดคำศัพท์ได้ทั้งคู่)
//   tts:wasm-60 tts:wasm-100 tts:webgpu-100 — สร้างไฟล์เสียงในเบราว์เซอร์ผ่านการ์ด "สร้างไฟล์เสียง" ของหน้า text-to-speech.html จริง (Section 5) · วัด "วินาทีต่อ 1,000 ตัวอักษร" ของข้อความใน
//                                             local/tts/*.txt (ไม่ต้องมีไฟล์เฉลย) · wasm-60 / wasm-100 = WASM ปิดตัวเลือก WebGPU, เพดานท่อน 60 / 100 ตัวอักษร (เทียบการรวมบรรทัดกับค่าเดิม) · webgpu-100 = WebGPU จริง (ใช้ --headed
//                                             เหมือน asr:gpu-*) ถอย WASM = แถวนั้นขึ้น ERROR · ใช้เลือกค่า MAX_CHUNK (tts-normalize.js) ที่เร็วสุดโดยเสียงยังดี
//   ocr:tesseract                           — แนบไฟล์ (เปิด OCR) ในหน้า text-to-speech.html → file-reader.js เส้นทางเดียวกับผู้ใช้
//   ocr:claude                              — POST /api/ocr (prompt เริ่มต้นของเซิร์ฟเวอร์, โมเดลค่าเริ่มต้นของเซิร์ฟเวอร์) บน pages.dev (ต้องตั้ง env เหมือน asr:cloud + MEDIA_EVAL_OCR_PIN)
//   ocr:claude-sonnet-5 ocr:claude-sonnet-5-5 ocr:claude-haiku-5-5 — เหมือน ocr:claude แต่ระบุโมเดลตัวเลขชัดเจน (allowlist ใน functions/api/ocr.js) ให้วัด CER/เวลาก่อนเลือกค่าเริ่มต้น
//     ทุกตัวที่เรียก Claude ต้องมี env MEDIA_EVAL_OCR_PIN (รหัส OCR_PIN ที่ตั้งใน Cloudflare) — ไม่ตั้ง = ข้าม · รหัสผิดครั้งเดียวสคริปต์หยุดเรียก Claude ทั้งหมด (กันล็อก 15 นาที) · ไม่พิมพ์รหัสที่ไหน
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, basename, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cer, wer } from './metrics.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const LOCAL = join(HERE, 'local');
const require = createRequire(join(ROOT, 'tests/package.json'));
let chromium;
try { ({ chromium } = require('@playwright/test')); } catch (e) {
  console.error('ไม่พบ Playwright — รัน `cd tests && npm ci && npx playwright install chromium` ก่อน');
  process.exit(1);
}

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : dflt; };
const CLOUD_URL = (process.env.MEDIA_EVAL_URL || '').replace(/\/+$/, '');
const CLOUD_COOKIE = process.env.MEDIA_EVAL_COOKIE || '';
const CLOUD_OK = !!(CLOUD_URL && CLOUD_COOKIE);
const ALLOW_PAID = process.env.MEDIA_EVAL_ALLOW_PAID === '1';
const OCR_PIN = process.env.MEDIA_EVAL_OCR_PIN || ''; // ห้ามพิมพ์/บันทึกลงผลลัพธ์
const CLAUDE_MODEL_OF = { 'ocr:claude': null, 'ocr:claude-sonnet-5': 'claude-sonnet-5', 'ocr:claude-sonnet-5-5': 'claude-sonnet-5-5', 'ocr:claude-haiku-5-5': 'claude-haiku-5-5' };
let claudeStopped = false; // รหัสผิด/ล็อก/ไม่ได้ตั้ง → หยุดเรียก Claude ที่เหลือ
const TTS_ENGINES = { 'tts:wasm-60': { max: 60, gpu: false }, 'tts:wasm-100': { max: 100, gpu: false }, 'tts:webgpu-100': { max: 100, gpu: true } };
const ALL_ENGINES = ['asr:tiny', 'asr:base', 'asr:small', 'asr:medium', 'asr:th-small', 'asr:th-medium', 'asr:gpu-tiny', 'asr:gpu-base', 'asr:gpu-small', 'asr:gpu-large', 'asr:gpu-th-small', 'asr:gpu-th-medium', 'asr:cloud', 'asr:cloud-seq', 'ocr:tesseract', ...Object.keys(CLAUDE_MODEL_OF), ...Object.keys(TTS_ENGINES)];
const ENGINES = (opt('engines', '') || ALL_ENGINES.join(',')).split(',').map((s) => s.trim()).filter(Boolean);
const ONLY = opt('only', '') ? new RegExp(opt('only')) : null;
const LANG = opt('lang', 'auto'); // auto | thai | english — ตัวเลือก "ภาษา" ของหน้า text-to-speech
const HEADED = args.includes('--headed');
const TIMEOUT = +(opt('timeout-min', '60')) * 60000;
const ASR_EXT = /\.(wav|mp3|m4a|aac|ogg|oga|opus|flac|webm|mp4|mov|m4v)$/i;
const OCR_EXT = /\.(png|jpe?g|webp|bmp|pdf)$/i;
const MODEL_OF = { 'asr:tiny': 'Xenova/whisper-tiny', 'asr:base': 'Xenova/whisper-base', 'asr:small': 'Xenova/whisper-small', 'asr:medium': 'Xenova/whisper-medium',
  // Thonburian Whisper (Section 3 ข้อ 3) บน WASM — เบราว์เซอร์ปกติไม่มี WebGPU จึงถอดบน WASM q8 · th-medium ต้อง navigator.deviceMemory ≥ 8 (ไม่งั้นตัวเลือกไม่ขึ้น → แถวนั้นขึ้น ERROR)
  'asr:th-small': 'Tanotfin/distill-whisper-th-small-onnx', 'asr:th-medium': 'Tanotfin/distill-whisper-th-medium-onnx' };
const GPU_MODEL_OF = { 'asr:gpu-tiny': 'onnx-community/whisper-tiny', 'asr:gpu-base': 'onnx-community/whisper-base', 'asr:gpu-small': 'onnx-community/whisper-small', 'asr:gpu-large': 'onnx-community/whisper-large-v3-turbo',
  // Thonburian บน WebGPU (small = encoder fp32 + decoder q4 · medium = encoder fp16 + decoder q4 ต้องมี shader-f16)
  'asr:gpu-th-small': 'Tanotfin/distill-whisper-th-small-onnx', 'asr:gpu-th-medium': 'Tanotfin/distill-whisper-th-medium-onnx' };
const CLOUD_DOMAIN = opt('cloud-domain', 'general'); // general | law | engineering | invest — ช่อง "ประเภทเนื้อหา" ของหน้า (โหมดคลาวด์)
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.wasm': 'application/wasm', '.woff2': 'font/woff2' };

async function pairs(dir, re) {
  let names = [];
  try { names = await readdir(dir); } catch (e) { return []; }
  const out = [];
  for (const n of names.sort()) {
    if (!re.test(n) || (ONLY && !ONLY.test(n))) continue;
    const ref = join(dir, n.replace(/\.[^.]+$/, '') + '.txt');
    try { out.push({ name: n, path: join(dir, n), ref: (await readFile(ref, 'utf8')).trim() }); }
    catch (e) { console.warn('ข้าม ' + n + ' — ไม่มีไฟล์เฉลย ' + basename(ref)); }
  }
  return out;
}

function staticServer() {
  return new Promise((res) => {
    const srv = createServer(async (req, rsp) => {
      try {
        let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
        if (p.endsWith('/')) p += 'index.html';
        const f = resolve(ROOT, '.' + p);
        if (!f.startsWith(ROOT) || f.startsWith(LOCAL)) throw new Error('forbidden');
        const body = await readFile(f);
        rsp.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
        rsp.end(body);
      } catch (e) { rsp.writeHead(404); rsp.end('not found'); }
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

function cookiesFor(url) {
  return CLOUD_COOKIE.split(';').map((c) => c.trim()).filter(Boolean).map((c) => {
    const i = c.indexOf('=');
    return { name: c.slice(0, i), value: c.slice(i + 1), url };
  });
}

/* ถอดเสียง 1 ไฟล์ผ่าน UI จริงของหน้า → { text, ms, dur, err, webgpu, neurons } · opts: { cloud, expectGpu } */
async function asrViaPage(page, file, modelId, opts = {}) {
  await page.setInputFiles('#asrFile', file);
  await page.selectOption('#asrLang', LANG);
  if (opts.cloud) await page.selectOption('#asrDomain', CLOUD_DOMAIN);
  if (modelId) {
    // ตัวเลือกรุ่นใหม่ปรากฏเมื่อหน้าตรวจ WebGPU เสร็จและใช้ได้จริงเท่านั้น
    await page.waitForFunction((m) => [...document.querySelectorAll('#asrModel option')].some((o) => o.value === m), modelId, { timeout: 15000 }).catch(() => {});
    await page.selectOption('#asrModel', modelId);
  }
  const usedBefore = opts.cloud ? await neuronsUsed(page) : null;
  const t0 = Date.now();
  await page.click('#asrGoBtn');
  await page.waitForFunction(() => /\b(ok|err)\b/.test(document.getElementById('asrStatus').className) && !document.getElementById('asrGoBtn').disabled, null, { timeout: TIMEOUT });
  const ms = Date.now() - t0;
  const ok = await page.evaluate(() => /\bok\b/.test(document.getElementById('asrStatus').className));
  const dur = await page.evaluate(() => window.__tts.getMediaDuration(document.getElementById('asrFile').files[0]));
  if (!ok) return { text: '', ms, dur, err: await page.textContent('#asrStatus') };
  const webgpu = /WebGPU/.test(await page.textContent('#asrStatus')) && !/ใช้ไม่ได้|unavailable/.test(await page.textContent('#asrStatus'));
  if (opts.expectGpu && !webgpu) return { text: '', ms, dur, err: 'ไม่ได้ใช้ WebGPU จริง (ถอย WASM หรือไม่มี WebGPU) — ' + (await page.textContent('#asrStatus')) };
  const usedAfter = opts.cloud ? await neuronsUsed(page) : null;
  return { text: await page.inputValue('#asrResult'), ms, dur, webgpu, neurons: usedBefore != null && usedAfter != null ? usedAfter - usedBefore : null };
}
/* Neurons ที่ใช้ไปวันนี้ จากบรรทัดสถานะของหน้า ("… {used} / {limit} …") — ใช้หาผลต่างต่อไฟล์ */
async function neuronsUsed(page) {
  await page.waitForTimeout(800); // ให้ refreshServerNeuronUsage() ตอบก่อน
  const t = (await page.textContent('#asrNeuronStatus')) || '';
  const m = /([\d,]+)\s*\/\s*([\d,]+)/.exec(t);
  return m ? +m[1].replace(/,/g, '') : null;
}

async function openTts(ctx, base, engine, cloudCfg) {
  const page = await ctx.newPage();
  await page.addInitScript((e) => { try { localStorage.setItem('tanot:asr:engine', e); } catch (x) {} }, engine);
  if (cloudCfg) await page.addInitScript((c) => { window.TANOT_ASR_CLOUD = c; }, cloudCfg); // asr-cloud.js: { parallel, overlapSec } (asr:cloud-seq = ทีละท่อนไม่เหลื่อม)
  page.on('dialog', (d) => (ALLOW_PAID ? d.accept() : d.dismiss())); // ยืนยันค่าใช้จ่ายเกินโควตาฟรี — ปฏิเสธเว้นแต่ตั้ง MEDIA_EVAL_ALLOW_PAID=1
  await page.goto(base + '/text-to-speech.html');
  return page;
}

/* WAV เงียบ 1 วินาที — อุ่นเครื่อง (ดาวน์โหลด + โหลดโมเดล) ก่อนจับเวลาไฟล์จริง */
function silentWav() {
  const n = 16000, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(16000, 24); b.writeUInt32LE(32000, 28); b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  return { name: 'warmup.wav', mimeType: 'audio/wav', buffer: b };
}

/* ไฟล์ข้อความสำหรับวัดเสียงพูด (ไม่มีไฟล์เฉลย) — ห้าม commit (local/ ถูก gitignore) */
async function texts(dir) {
  let names = [];
  try { names = await readdir(dir); } catch (e) { return []; }
  const out = [];
  for (const n of names.sort()) {
    if (!/\.txt$/i.test(n) || (ONLY && !ONLY.test(n))) continue;
    out.push({ name: n, text: (await readFile(join(dir, n), 'utf8')).trim() });
  }
  return out.filter((f) => f.text);
}
/* สร้างไฟล์เสียง 1 ไฟล์ผ่าน UI จริง → { ms, chars, chunks, workers, device, err } · opts: { expectGpu } */
async function ttsViaPage(page, text, opts = {}) {
  await page.fill('#ttsText', text);
  const t0 = Date.now();
  await page.click('#dlGenerateBtn');
  await page.waitForFunction(() => /\b(ok|err)\b/.test(document.getElementById('dlStatus').className) && !document.getElementById('dlGenerateBtn').disabled, null, { timeout: TIMEOUT });
  const ms = Date.now() - t0;
  const ok = await page.evaluate(() => /\bok\b/.test(document.getElementById('dlStatus').className));
  if (!ok) return { ms, chars: text.length, err: await page.textContent('#dlStatus') };
  // สถิติที่หน้าบันทึกลง problem log หลังงานเสร็จ (ตัวเลขล้วน: chunks=… workers=… device=…)
  const row = await page.evaluate(() => { const r = JSON.parse(localStorage.getItem('tanot:media:log') || '[]').filter((x) => x.kind === 'tts' && x.stage === 'stats'); return r.length ? r[r.length - 1].msg : ''; });
  const g = (k) => { const m = new RegExp('\\b' + k + '=([\\w.]+)').exec(row); return m ? m[1] : null; };
  const device = g('device');
  if (opts.expectGpu && device !== 'webgpu') return { ms, chars: text.length, err: 'ไม่ได้ใช้ WebGPU จริง (ถอย WASM หรือไม่มี WebGPU) — device=' + device };
  return { ms, chars: text.length, chunks: +g('chunks') || null, workers: +g('workers') || null, device };
}

async function ocrTesseract(page, file) {
  await page.setInputFiles('#importFileInput', file);
  const t0 = Date.now();
  await page.waitForFunction(() => /\b(ok|err)\b/.test(document.getElementById('importStatus').className) && !document.getElementById('importFileBtn').disabled, null, { timeout: TIMEOUT });
  const ms = Date.now() - t0;
  const ok = await page.evaluate(() => /\bok\b/.test(document.getElementById('importStatus').className));
  return ok ? { text: await page.inputValue('#ttsText'), ms } : { text: '', ms, err: await page.textContent('#importStatus') };
}

async function ocrClaude(file, model) {
  const buf = await readFile(file);
  const ext = extname(file).toLowerCase();
  const body = ext === '.pdf'
    ? { pdfBase64: buf.toString('base64') }
    : { imageBase64: buf.toString('base64'), mediaType: ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg' };
  if (model) body.model = model;
  const t0 = Date.now();
  const res = await fetch(CLOUD_URL + '/api/ocr', {
    method: 'POST', redirect: 'manual',
    headers: { 'Content-Type': 'application/json', Cookie: CLOUD_COOKIE, Origin: CLOUD_URL, 'X-OCR-Pin': OCR_PIN },
    body: JSON.stringify(body)
  });
  const ms = Date.now() - t0;
  if (res.status >= 300 && res.status < 400) return { text: '', ms, err: 'redirected to login — คุกกี้ Access หมดอายุ?' };
  const data = await res.json().catch(() => ({}));
  if (/^pin_/.test(data.code || '')) { claudeStopped = true; return { text: '', ms, err: data.code + ' — หยุดเรียก Claude ที่เหลือ (' + (data.error || res.status) + ')' }; }
  return res.ok ? { text: data.text || '', ms } : { text: '', ms, err: data.error || 'HTTP ' + res.status };
}

const pct = (x) => (x == null ? '—' : (x * 100).toFixed(1) + '%');

/* WebGPU ต้องเปิดตั้งแต่ตอนเปิดเบราว์เซอร์ (แฟล็กระดับโพรเซส) — เปิดอีกตัวแยกเฉพาะเอนจิน asr:gpu-* · ไม่มี GPU จริง = หน้าจะถอย WASM แล้วแถวขึ้น ERROR */
let gpuBrowser = null;
async function gpuContext() {
  if (!gpuBrowser) gpuBrowser = await chromium.launch({ channel: 'chromium', headless: !HEADED, args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--ignore-gpu-blocklist'] });
  return gpuBrowser.newContext();
}

async function main() {
  const asrFiles = ENGINES.some((e) => e.startsWith('asr:')) ? await pairs(join(LOCAL, 'asr'), ASR_EXT) : [];
  const ocrFiles = ENGINES.some((e) => e.startsWith('ocr:')) ? await pairs(join(LOCAL, 'ocr'), OCR_EXT) : [];
  const ttsEngines = ENGINES.filter((e) => e in TTS_ENGINES);
  const ttsFiles = ttsEngines.length ? await texts(join(LOCAL, 'tts')) : [];
  if (!asrFiles.length && !ocrFiles.length && !ttsFiles.length) {
    console.log('ไม่มีไฟล์ตัวอย่าง — วางไฟล์ใน tools/media-eval/local/asr/ และ local/ocr/ พร้อมไฟล์เฉลย .txt ชื่อเดียวกัน · local/tts/*.txt = ข้อความวัดเสียงพูด (ดู README.md)');
    return;
  }
  const srv = await staticServer();
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ channel: 'chromium', headless: !HEADED });
  const results = [], ttsRows = [];
  const record = (kind, engine, f, r) => {
    const row = { kind, engine, file: f.name, cer: r.err ? null : cer(f.ref, r.text), wer: r.err ? null : wer(f.ref, r.text), sec: +(r.ms / 1000).toFixed(1), audioSec: r.dur != null ? Math.round(r.dur) : null, neurons: r.neurons != null ? Math.round(r.neurons) : null, webgpu: r.webgpu || false, err: r.err || null };
    row.rtf = row.audioSec ? +(row.sec / row.audioSec).toFixed(3) : null;
    results.push(row);
    console.log([kind, engine, f.name, 'CER ' + pct(row.cer), 'WER ' + pct(row.wer), row.sec + ' วิ', row.neurons != null ? row.neurons + ' Neurons' : '', row.err ? 'ERROR: ' + row.err : ''].join('  '));
  };
  try {
    for (const engine of ENGINES) {
      if (engine.startsWith('asr:') && asrFiles.length) {
        if (engine === 'asr:cloud' || engine === 'asr:cloud-seq') {
          if (!CLOUD_OK) { console.log('ข้าม ' + engine + ' — ไม่ได้ตั้ง MEDIA_EVAL_URL / MEDIA_EVAL_COOKIE'); continue; }
          const ctx = await browser.newContext();
          await ctx.addCookies(cookiesFor(CLOUD_URL));
          const page = await openTts(ctx, CLOUD_URL, 'cloud', engine === 'asr:cloud-seq' ? { parallel: 1, overlapSec: 0 } : null);
          for (const f of asrFiles) record('asr', engine, f, await asrViaPage(page, f.path, null, { cloud: true }));
          await ctx.close();
        } else if (GPU_MODEL_OF[engine]) {
          const ctx = await gpuContext();
          const page = await openTts(ctx, base, 'local');
          console.log(engine + ': อุ่นเครื่อง (ครั้งแรกดาวน์โหลดโมเดลจาก Hugging Face) …');
          await asrViaPage(page, silentWav(), GPU_MODEL_OF[engine], { expectGpu: true });
          for (const f of asrFiles) record('asr', engine, f, await asrViaPage(page, f.path, GPU_MODEL_OF[engine], { expectGpu: true }));
          await ctx.close();
        } else if (MODEL_OF[engine]) {
          const ctx = await browser.newContext();
          const page = await openTts(ctx, base, 'local');
          console.log(engine + ': อุ่นเครื่อง (ครั้งแรกดาวน์โหลดโมเดลจาก Hugging Face)…');
          await asrViaPage(page, silentWav(), MODEL_OF[engine]);
          for (const f of asrFiles) record('asr', engine, f, await asrViaPage(page, f.path, MODEL_OF[engine]));
          await ctx.close();
        }
      }
      if (engine in TTS_ENGINES && ttsFiles.length) {
        const cfg = TTS_ENGINES[engine];
        const ctx = cfg.gpu ? await gpuContext() : await browser.newContext();
        const page = await ctx.newPage();
        await page.addInitScript((c) => {
          try { localStorage.setItem('tanot:tts:opts', JSON.stringify({ skipParen: true, split: false, gpu: c.gpu })); localStorage.setItem('tanot:asr:lang', 'auto'); } catch (x) {}
          window.TANOT_TTS = { maxChunk: c.max };
        }, cfg);
        await page.goto(base + '/text-to-speech.html');
        console.log(engine + ': อุ่นเครื่อง (ครั้งแรกดาวน์โหลดโมเดลจาก Hugging Face)…');
        await ttsViaPage(page, 'ทดสอบเสียงพูดสั้นๆ สำหรับอุ่นเครื่องก่อนจับเวลา', { expectGpu: cfg.gpu });
        for (const f of ttsFiles) {
          const r = await ttsViaPage(page, f.text, { expectGpu: cfg.gpu });
          const row = { kind: 'tts', engine, file: f.name, chars: r.chars, chunks: r.chunks || null, workers: r.workers || null, device: r.device || null, sec: +(r.ms / 1000).toFixed(1), secPer1000: r.err ? null : +((r.ms / 1000) / (r.chars / 1000)).toFixed(1), err: r.err || null };
          ttsRows.push(row);
          console.log(['tts', engine, f.name, row.chars + ' ตัวอักษร', row.chunks != null ? row.chunks + ' ท่อน' : '', row.sec + ' วิ', row.secPer1000 != null ? row.secPer1000 + ' วิ/1,000 ตัวอักษร' : '', row.err ? 'ERROR: ' + row.err : ''].filter(Boolean).join('  '));
        }
        await ctx.close();
      }
      if (engine === 'ocr:tesseract' && ocrFiles.length) {
        const ctx = await browser.newContext();
        const page = await openTts(ctx, base, 'local');
        await page.check('#importOcrChk');
        for (const f of ocrFiles) record('ocr', engine, f, await ocrTesseract(page, f.path));
        await ctx.close();
      }
      if (engine in CLAUDE_MODEL_OF && ocrFiles.length) {
        if (!CLOUD_OK) { console.log('ข้าม ' + engine + ' — ไม่ได้ตั้ง MEDIA_EVAL_URL / MEDIA_EVAL_COOKIE'); continue; }
        if (!OCR_PIN) { console.log('ข้าม ' + engine + ' — ไม่ได้ตั้ง MEDIA_EVAL_OCR_PIN'); continue; }
        for (const f of ocrFiles) {
          if (claudeStopped) { console.log('ข้าม ' + engine + ' ' + f.name + ' — รหัสไม่ผ่านก่อนหน้านี้'); continue; }
          record('ocr', engine, f, await ocrClaude(f.path, CLAUDE_MODEL_OF[engine]));
        }
      }
    }
  } finally {
    await browser.close();
    if (gpuBrowser) await gpuBrowser.close();
    srv.close();
  }

  const summary = {};
  for (const r of results) {
    const k = r.kind + ' ' + r.engine, s = summary[k] || (summary[k] = { n: 0, err: 0, cer: 0, wer: 0, sec: 0, audio: 0, neu: 0, neuN: 0 });
    s.n++; s.sec += r.sec;
    if (r.err) { s.err++; continue; }
    s.cer += r.cer; s.wer += r.wer; s.audio += r.audioSec || 0;
    if (r.neurons != null) { s.neu += r.neurons; s.neuN++; }
  }
  const lines = Object.keys(summary).length ? ['| เอนจิน | ไฟล์ | ล้มเหลว | CER เฉลี่ย | WER เฉลี่ย | เวลารวม (วิ) | เวลา/ความยาวเสียง | Neurons รวม (คลาวด์) |', '|---|---|---|---|---|---|---|---|'] : [];
  for (const [k, s] of Object.entries(summary)) {
    const ok = s.n - s.err;
    lines.push(`| ${k} | ${s.n} | ${s.err} | ${ok ? pct(s.cer / ok) : '—'} | ${ok ? pct(s.wer / ok) : '—'} | ${s.sec.toFixed(1)} | ${s.audio ? (s.sec / s.audio).toFixed(3) : '—'} | ${s.neuN ? s.neu : '—'} |`);
  }
  if (ttsRows.length) {
    const by = {};
    for (const r of ttsRows) { const s2 = by[r.engine] || (by[r.engine] = { n: 0, err: 0, sec: 0, chars: 0, chunks: 0, per: 0 }); s2.n++; if (r.err) { s2.err++; continue; } s2.sec += r.sec; s2.chars += r.chars; s2.chunks += r.chunks || 0; s2.per += r.secPer1000; }
    if (lines.length) lines.push('');
    lines.push('| เอนจินเสียงพูด | ไฟล์ | ล้มเหลว | เวลารวม (วิ) | ตัวอักษรรวม | ท่อนรวม | วิ/1,000 ตัวอักษร (เฉลี่ยต่อไฟล์) |', '|---|---|---|---|---|---|---|');
    for (const [k, s2] of Object.entries(by)) { const ok2 = s2.n - s2.err; lines.push(`| ${k} | ${s2.n} | ${s2.err} | ${s2.sec.toFixed(1)} | ${s2.chars} | ${s2.chunks || '—'} | ${ok2 ? (s2.per / ok2).toFixed(1) : '—'} |`); }
  }
  console.log('\n' + lines.join('\n'));
  await mkdir(LOCAL, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
  await writeFile(join(LOCAL, `results-${stamp}.json`), JSON.stringify({ at: new Date().toISOString(), lang: LANG, engines: ENGINES, results, tts: ttsRows }, null, 2));
  await writeFile(join(LOCAL, `results-${stamp}.md`), lines.join('\n') + '\n');
  console.log('\nบันทึกผลที่ tools/media-eval/local/results-' + stamp + '.json|md');
}

main().catch((e) => { console.error(e); process.exit(1); });
