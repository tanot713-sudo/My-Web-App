// ชุดวัดผลถอดเสียง/OCR ของ Tanot (Section 0) — รันในเครื่องเจ้าของเท่านั้น ไม่อยู่ใน CI (เอนจินในเบราว์เซอร์ต้องโหลดโมเดลจาก Hugging Face)
// วิธีใช้/วางไฟล์: ดู README.md ในโฟลเดอร์นี้ · ผลลัพธ์เขียนที่ tools/media-eval/local/results-*.json|md (โฟลเดอร์ local/ ไม่ถูก commit)
//
// เอนจิน (--engines a,b,…; ค่าเริ่มต้น = ทุกตัวที่ใช้ได้):
//   asr:tiny asr:base asr:small asr:medium  — Whisper ในเบราว์เซอร์ ผ่านหน้า text-to-speech.html จริง (เซิร์ฟเวอร์ static ในเครื่อง)
//   asr:cloud                               — ปุ่มคลาวด์ของหน้าเดียวกันบน pages.dev (ต้องตั้ง MEDIA_EVAL_URL + MEDIA_EVAL_COOKIE)
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
const ALL_ENGINES = ['asr:tiny', 'asr:base', 'asr:small', 'asr:medium', 'asr:cloud', 'ocr:tesseract', ...Object.keys(CLAUDE_MODEL_OF)];
const ENGINES = (opt('engines', '') || ALL_ENGINES.join(',')).split(',').map((s) => s.trim()).filter(Boolean);
const ONLY = opt('only', '') ? new RegExp(opt('only')) : null;
const LANG = opt('lang', 'auto'); // auto | thai | english — ตัวเลือก "ภาษา" ของหน้า text-to-speech
const HEADED = args.includes('--headed');
const TIMEOUT = +(opt('timeout-min', '60')) * 60000;
const ASR_EXT = /\.(wav|mp3|m4a|aac|ogg|oga|opus|flac|webm|mp4|mov|m4v)$/i;
const OCR_EXT = /\.(png|jpe?g|webp|bmp|pdf)$/i;
const MODEL_OF = { 'asr:tiny': 'Xenova/whisper-tiny', 'asr:base': 'Xenova/whisper-base', 'asr:small': 'Xenova/whisper-small', 'asr:medium': 'Xenova/whisper-medium' };
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

/* ถอดเสียง 1 ไฟล์ผ่าน UI จริงของหน้า → { text, ms, dur, err } */
async function asrViaPage(page, file, modelId) {
  await page.setInputFiles('#asrFile', file);
  await page.selectOption('#asrLang', LANG);
  if (modelId) await page.selectOption('#asrModel', modelId);
  const t0 = Date.now();
  await page.click('#asrGoBtn');
  await page.waitForFunction(() => /\b(ok|err)\b/.test(document.getElementById('asrStatus').className) && !document.getElementById('asrGoBtn').disabled, null, { timeout: TIMEOUT });
  const ms = Date.now() - t0;
  const ok = await page.evaluate(() => /\bok\b/.test(document.getElementById('asrStatus').className));
  const dur = await page.evaluate(() => window.__tts.getMediaDuration(document.getElementById('asrFile').files[0]));
  return ok ? { text: await page.inputValue('#asrResult'), ms, dur } : { text: '', ms, dur, err: await page.textContent('#asrStatus') };
}

async function openTts(ctx, base, engine) {
  const page = await ctx.newPage();
  await page.addInitScript((e) => { try { localStorage.setItem('tanot:asr:engine', e); } catch (x) {} }, engine);
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

async function main() {
  const asrFiles = ENGINES.some((e) => e.startsWith('asr:')) ? await pairs(join(LOCAL, 'asr'), ASR_EXT) : [];
  const ocrFiles = ENGINES.some((e) => e.startsWith('ocr:')) ? await pairs(join(LOCAL, 'ocr'), OCR_EXT) : [];
  if (!asrFiles.length && !ocrFiles.length) {
    console.log('ไม่มีไฟล์ตัวอย่าง — วางไฟล์ใน tools/media-eval/local/asr/ และ local/ocr/ พร้อมไฟล์เฉลย .txt ชื่อเดียวกัน (ดู README.md)');
    return;
  }
  const srv = await staticServer();
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ channel: 'chromium', headless: !HEADED });
  const results = [];
  const record = (kind, engine, f, r) => {
    const row = { kind, engine, file: f.name, cer: r.err ? null : cer(f.ref, r.text), wer: r.err ? null : wer(f.ref, r.text), sec: +(r.ms / 1000).toFixed(1), audioSec: r.dur != null ? Math.round(r.dur) : null, err: r.err || null };
    row.rtf = row.audioSec ? +(row.sec / row.audioSec).toFixed(3) : null;
    results.push(row);
    console.log([kind, engine, f.name, 'CER ' + pct(row.cer), 'WER ' + pct(row.wer), row.sec + ' วิ', row.err ? 'ERROR: ' + row.err : ''].join('  '));
  };
  try {
    for (const engine of ENGINES) {
      if (engine.startsWith('asr:') && asrFiles.length) {
        if (engine === 'asr:cloud') {
          if (!CLOUD_OK) { console.log('ข้าม asr:cloud — ไม่ได้ตั้ง MEDIA_EVAL_URL / MEDIA_EVAL_COOKIE'); continue; }
          const ctx = await browser.newContext();
          await ctx.addCookies(cookiesFor(CLOUD_URL));
          const page = await openTts(ctx, CLOUD_URL, 'cloud');
          for (const f of asrFiles) record('asr', engine, f, await asrViaPage(page, f.path, null));
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
    srv.close();
  }

  const summary = {};
  for (const r of results) {
    const k = r.kind + ' ' + r.engine, s = summary[k] || (summary[k] = { n: 0, err: 0, cer: 0, wer: 0, sec: 0, audio: 0 });
    s.n++; s.sec += r.sec;
    if (r.err) { s.err++; continue; }
    s.cer += r.cer; s.wer += r.wer; s.audio += r.audioSec || 0;
  }
  const lines = ['| เอนจิน | ไฟล์ | ล้มเหลว | CER เฉลี่ย | WER เฉลี่ย | เวลารวม (วิ) | เวลา/ความยาวเสียง |', '|---|---|---|---|---|---|---|'];
  for (const [k, s] of Object.entries(summary)) {
    const ok = s.n - s.err;
    lines.push(`| ${k} | ${s.n} | ${s.err} | ${ok ? pct(s.cer / ok) : '—'} | ${ok ? pct(s.wer / ok) : '—'} | ${s.sec.toFixed(1)} | ${s.audio ? (s.sec / s.audio).toFixed(3) : '—'} |`);
  }
  console.log('\n' + lines.join('\n'));
  await mkdir(LOCAL, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
  await writeFile(join(LOCAL, `results-${stamp}.json`), JSON.stringify({ at: new Date().toISOString(), lang: LANG, engines: ENGINES, results }, null, 2));
  await writeFile(join(LOCAL, `results-${stamp}.md`), lines.join('\n') + '\n');
  console.log('\nบันทึกผลที่ tools/media-eval/local/results-' + stamp + '.json|md');
}

main().catch((e) => { console.error(e); process.exit(1); });
