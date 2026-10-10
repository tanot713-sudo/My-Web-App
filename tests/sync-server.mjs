// Phase 3 Web Push: /api/push/* ตัวจริง + คีย์ VAPID ที่สร้างตอนเริ่ม · /__pushsink/<id> = บริการ push ตัวหลอก (เก็บคำขอที่เข้ารหัสแล้วไว้ที่ /__pushlog,
//   /__pushsink?status=<code>&id=<id> ตั้งรหัสตอบกลับ) · /__tick?now= /__daily?now= รัน functions/_lib/scheduler.js · /__push = ดูตาราง push_subs/reminders · /__vapid?off=1 จำลองยังไม่ตั้งคีย์
// เซิร์ฟเวอร์ทดสอบ Phase 1/4: เสิร์ฟไฟล์ static จาก root + รัน functions/api/sync.js และ functions/api/ai/*, asr.js ตัวจริง บน SQLite ของ Node (แทน D1)
// Phase 4: env.AI เป็นตัวหลอก (ไม่เรียก Workers AI จริง) — /__ai?mode=ok|quota|down คุมพฤติกรรม, /__ai?limit=N ตั้งเพดาน Neurons/วัน, /__ailog ดูคำขอที่โมเดลได้รับ
// ใช้ schema จริงจาก migrations/*.sql — รัน: node sync-server.mjs [port]   (POST /__reset ล้างฐานข้อมูล, /__offline=1|0 จำลองเซิร์ฟเวอร์ล่ม)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = +(process.argv[2] || process.env.SYNC_PORT || 8124);
const load = (f) => import(pathToFileURL(path.join(ROOT, f)).href);
const sync = await load('functions/api/sync.js');
const files = await load('functions/api/files.js');
const PUSH_ROUTES = {
  '/api/push/config': await load('functions/api/push/config.js'),
  '/api/push/subscribe': await load('functions/api/push/subscribe.js'),
  '/api/push/unsubscribe': await load('functions/api/push/unsubscribe.js'),
  '/api/push/test': await load('functions/api/push/test.js'),
  '/api/push/reminders': await load('functions/api/push/reminders.js'),
};
const scheduler = await load('functions/_lib/scheduler.js');
const AI_ROUTES = {
  '/api/ai/chat': await load('functions/api/ai/chat.js'),
  '/api/ai/summarize': await load('functions/api/ai/summarize.js'),
  '/api/ai/embed': await load('functions/api/ai/embed.js'),
  '/api/ai/usage': await load('functions/api/ai/usage.js'),
  '/api/ai/image': await load('functions/api/ai/image.js'),
  '/api/asr': await load('functions/api/asr.js'),
  '/api/ocr': await load('functions/api/ocr.js'),
};

let sqlite;
function resetDb() {
  sqlite = new DatabaseSync(':memory:');
  for (const f of fs.readdirSync(path.join(ROOT, 'migrations')).sort()) sqlite.exec(fs.readFileSync(path.join(ROOT, 'migrations', f), 'utf8'));
}
resetDb();

// Workers AI ตัวหลอก: gemma (main) ตอบรูปแบบ { response } / สตรีม data:{"response"}, qwen (fast) ตอบรูปแบบ chat-completions + <think> เพื่อทดสอบตัวแปลงทั้ง 2 แบบ
let aiMode = 'ok', aiLimit, aiLog = [];
const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const sse = (obj) => 'data: ' + JSON.stringify(obj) + '\n\n';
const AI = {
  async run(model, input) {
    aiLog.push({ model, input });
    if (aiMode === 'down') throw new Error('upstream unavailable');
    if (aiMode === 'quota') throw new Error('4006: you have used up your daily free allocation of 10,000 neurons');
    if (model.includes('flux')) {
      // FLUX ตัวหลอก: schnell รับ JSON { prompt, steps }, klein รับ multipart — บันทึกฟิลด์ที่ได้รับลง aiLog แล้วตอบ PNG 1×1 เป็น base64
      if (input.multipart) {
        const fd = await new Response(input.multipart.body, { headers: { 'content-type': input.multipart.contentType } }).formData();
        aiLog[aiLog.length - 1].fields = Object.fromEntries([...fd.entries()]);
      }
      return { image: PNG_1X1 };
    }
    if (model.includes('bge-m3')) return { shape: [input.text.length, 8], data: input.text.map((t, i) => Array(8).fill((i + 1) / 10)) };
    const qwen = model.includes('qwen');
    if (input.stream) {
      const parts = qwen
        ? ['<thi', 'nk>คิดอยู่</think>สวัสดี', 'ครับ']
        : ['สวัสดี', 'ครับ'];
      const chunks = parts.map((p) => sse(qwen ? { choices: [{ delta: { content: p } }] } : { response: p }));
      chunks.push(sse({ response: '', usage: { prompt_tokens: 11, completion_tokens: 7 } }), 'data: [DONE]\n\n');
      // แบ่งไบต์กลางบรรทัดเพื่อทดสอบตัวอ่านสตรีมที่ต้องต่อบรรทัดข้ามท่อน
      const bytes = new TextEncoder().encode(chunks.join(''));
      return new ReadableStream({
        start(c) { for (let i = 0; i < bytes.length; i += 17) c.enqueue(bytes.slice(i, i + 17)); c.close(); },
      });
    }
    return qwen
      ? { choices: [{ message: { content: '<think>x</think>สรุปเร็ว' } }], usage: { prompt_tokens: 20, completion_tokens: 9 } }
      : { response: 'สรุปหลัก', usage: { prompt_tokens: 20, completion_tokens: 9 } };
  },
};

// OCR (/api/ocr ตัวจริง): OCR_PIN ตัวหลอกขึ้นต้นด้วย 246810 (ไม่ใช่รหัสจริง) · /__ocr?pin=<ค่า> เปลี่ยน (ว่าง = ไม่ตั้ง) · ?key=0|1 ถอด/ใส่ ANTHROPIC_API_KEY · ?mode=<โหมด Anthropic ตัวหลอก>
//   ok | flaky429 | flaky500 (ครั้งแรกล้ม ครั้งที่ 2 ผ่าน) | always429 | always500 | bad400 | auth401 | refusal | maxtokens · /__ocrlog = คำขอที่ Anthropic ตัวหลอกได้รับ (ไม่เก็บข้อมูลรูป เก็บแค่ชนิด/ขนาด)
//   /__ocrunlock = จำลองเวลาผ่านไปเกินช่วงล็อก · /__ocrdb = ตัวนับการลองรหัสใน D1
const OCR_DEFAULT_PIN = '246810';
let ocrPin = OCR_DEFAULT_PIN, ocrKey = true, ocrMode = 'ok', ocrLog = [], ocrCalls = 0;
const ocrEnv = () => ({ OCR_PIN: ocrPin || undefined, ANTHROPIC_API_KEY: ocrKey ? 'test-key' : undefined, ANTHROPIC_BASE_URL: `http://localhost:${PORT}/__anthropic` });
async function fakeAnthropic(req, res) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  ocrCalls++;
  const blocks = (body.messages[0].content || []).map((b) => (b.type === 'text' ? { type: 'text', text: b.text } : { type: b.type, media: b.source && b.source.media_type, len: b.source && b.source.data.length }));
  ocrLog.push({ model: body.model, thinking: body.thinking, max_tokens: body.max_tokens, blocks, key: req.headers['x-api-key'], version: req.headers['anthropic-version'], call: ocrCalls });
  const send = (status, obj, headers) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); Object.entries(headers || {}).forEach(([k, v]) => res.setHeader(k, v)); res.end(JSON.stringify(obj)); };
  const err = (status, message) => send(status, { type: 'error', error: { type: 'x', message } }, status === 429 ? { 'retry-after': '0.5' } : {});
  if (ocrMode === 'always429') return err(429, 'rate limited');
  if (ocrMode === 'always500') return err(500, 'boom');
  if (ocrMode === 'bad400') return err(400, 'messages.0.content.0.image: bad image');
  if (ocrMode === 'auth401') return err(401, 'invalid x-api-key');
  if (ocrMode === 'flaky429' && ocrCalls % 2 === 1) return err(429, 'rate limited');
  if (ocrMode === 'flaky500' && ocrCalls % 2 === 1) return err(500, 'boom');
  if (ocrMode === 'refusal') return send(200, { content: [], stop_reason: 'refusal', usage: { input_tokens: 5, output_tokens: 0 } });
  const isPdf = blocks.some((b) => b.type === 'document');
  const text = isPdf ? '[[หน้า 1]]\nหน้าแรก\n[[หน้า 2]]\nหน้าสอง' : 'ข้อความจากรูป';
  send(200, { content: [{ type: 'text', text }], stop_reason: ocrMode === 'maxtokens' ? 'max_tokens' : 'end_turn', usage: { input_tokens: 100, output_tokens: 20 } });
}

// R2 ตัวหลอก (Map ในหน่วยความจำ): put/get/delete ตามรูปแบบที่ functions/api/files.js ใช้ — /__files ดูกุญแจที่เก็บอยู่
const r2 = new Map();
const FILES = {
  async put(key, bytes, opts) { r2.set(key, { bytes: Buffer.from(bytes), type: opts && opts.httpMetadata && opts.httpMetadata.contentType }); },
  async get(key) { const o = r2.get(key); return o ? { body: new ReadableStream({ start(c) { c.enqueue(new Uint8Array(o.bytes)); c.close(); } }) } : null; },
  async delete(key) { r2.delete(key); },
  async list({ prefix = '' } = {}) { return { objects: [...r2.keys()].filter((k) => k.startsWith(prefix)).sort().map((key) => ({ key, size: r2.get(key).bytes.length })), truncated: false }; },
};

// VAPID: คู่คีย์ใหม่ทุกครั้งที่เริ่มเซิร์ฟเวอร์ (ไม่มีคีย์จริงใน repo) — public อ่านได้จาก /api/push/config
const vapidPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const VAPID = {
  VAPID_PUBLIC_KEY: Buffer.from(await crypto.subtle.exportKey('raw', vapidPair.publicKey)).toString('base64url'),
  VAPID_PRIVATE_KEY: (await crypto.subtle.exportKey('jwk', vapidPair.privateKey)).d,
  VAPID_SUBJECT: 'mailto:test@example.com',
};
let vapidOff = false, pushLog = [], sinkStatus = {};
const pushEnv = () => ({ DB, FILES, ...(vapidOff ? {} : VAPID), PUSH_DEV_ENDPOINT: `http://localhost:${PORT}/__pushsink/` });

// D1 shim: prepare().bind().all()/first()/run() + batch() (ทำใน transaction เดียวแบบ D1)
class Stmt {
  constructor(sql, params = []) { this.sql = sql; this.params = params; }
  bind(...p) { return new Stmt(this.sql, p); }
  _exec() {
    const st = sqlite.prepare(this.sql);
    const p = this.params.map((v) => (v === undefined ? null : v));
    let changes = 0;
    const results = /^\s*select|returning/i.test(this.sql) ? st.all(...p) : ((changes = Number(st.run(...p).changes)), []);
    return { results: results.map((r) => ({ ...r })), success: true, meta: { changes } }; // meta.changes เหมือน D1
  }
  async all() { return this._exec(); }
  async first() { return this._exec().results[0] || null; }
  async run() { return this._exec(); }
}
const DB = {
  prepare: (sql) => new Stmt(sql),
  async batch(stmts) {
    sqlite.exec('BEGIN');
    try { const out = stmts.map((s) => s._exec()); sqlite.exec('COMMIT'); return out; }
    catch (e) { sqlite.exec('ROLLBACK'); throw e; }
  },
};

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.wasm': 'application/wasm', '.woff2': 'font/woff2' };
let offline = false;

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/__reset') { resetDb(); r2.clear(); ocrPin = OCR_DEFAULT_PIN; ocrKey = true; ocrMode = 'ok'; ocrLog = []; ocrCalls = 0; aiMode = 'ok'; aiLimit = undefined; aiLog = []; pushLog = []; sinkStatus = {}; vapidOff = false; res.end('ok'); return; }
  if (url.pathname === '/__vapid') { vapidOff = url.searchParams.get('off') === '1'; res.end('ok'); return; }
  if (url.pathname === '/__pushsink' && url.searchParams.has('status')) { sinkStatus[url.searchParams.get('id')] = +url.searchParams.get('status'); res.end('ok'); return; }
  if (url.pathname.startsWith('/__pushsink/')) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const id = url.pathname.slice('/__pushsink/'.length);
    pushLog.push({ id, headers: req.headers, body: Buffer.concat(chunks).toString('base64') });
    res.statusCode = sinkStatus[id] || 201; res.end(); return;
  }
  if (url.pathname === '/__pushlog') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(pushLog)); if (url.searchParams.get('clear')) pushLog = []; return; }
  if (url.pathname === '/__push') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ subs: sqlite.prepare('SELECT * FROM push_subs').all(), reminders: sqlite.prepare('SELECT * FROM reminders ORDER BY due_at, id').all() }));
    return;
  }
  if (url.pathname === '/__tick' || url.pathname === '/__daily') {
    const now = +(url.searchParams.get('now') || Date.now());
    try {
      const out = url.pathname === '/__tick' ? await scheduler.runTick(pushEnv(), now) : await scheduler.runDaily(pushEnv(), now);
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(out));
    } catch (e) { res.statusCode = 500; res.end(String(e && e.stack || e)); }
    return;
  }
  if (PUSH_ROUTES[url.pathname]) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const request = new Request(url, { method: req.method, headers: req.headers, body: req.method === 'POST' ? Buffer.concat(chunks) : undefined });
    const mod = PUSH_ROUTES[url.pathname];
    const fn = req.method === 'GET' ? mod.onRequestGet : req.method === 'POST' ? mod.onRequestPost : null;
    if (!fn) { res.statusCode = 405; res.end(); return; }
    try {
      const out = await fn({ request, env: pushEnv(), data: { user: { email: 'test' } } });
      res.statusCode = out.status;
      out.headers.forEach((v, k) => res.setHeader(k, v));
      res.end(Buffer.from(await out.arrayBuffer()));
    } catch (e) { res.statusCode = 500; res.end(String(e && e.stack || e)); }
    return;
  }
  if (url.pathname === '/__offline') { offline = url.searchParams.get('v') === '1'; res.end('ok'); return; }
  if (url.pathname === '/__ai') {
    if (url.searchParams.has('mode')) aiMode = url.searchParams.get('mode');
    if (url.searchParams.has('limit')) aiLimit = url.searchParams.get('limit') || undefined;
    res.end('ok'); return;
  }
  if (url.pathname === '/__ocr') {
    if (url.searchParams.has('pin')) ocrPin = url.searchParams.get('pin');
    if (url.searchParams.has('key')) ocrKey = url.searchParams.get('key') !== '0';
    if (url.searchParams.has('mode')) { ocrMode = url.searchParams.get('mode'); ocrCalls = 0; }
    res.end('ok'); return;
  }
  if (url.pathname === '/__ocrlog') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(ocrLog)); if (url.searchParams.get('clear')) { ocrLog = []; ocrCalls = 0; } return; }
  if (url.pathname === '/__ocrunlock') { sqlite.exec('DELETE FROM ocr_pin_attempts; UPDATE ocr_pin_lock SET locked_until = 1'); res.end('ok'); return; }
  if (url.pathname === '/__ocrdb') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ attempts: sqlite.prepare('SELECT * FROM ocr_pin_attempts').all(), lock: sqlite.prepare('SELECT * FROM ocr_pin_lock').all() })); return; }
  if (url.pathname === '/__anthropic/v1/messages') { await fakeAnthropic(req, res); return; }
  if (url.pathname === '/__ailog') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(aiLog)); if (url.searchParams.get('clear')) aiLog = []; return; }
  if (url.pathname === '/__aidump') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(sqlite.prepare('SELECT key, task, model, result, hits FROM ai_cache').all())); return; }
  if (url.pathname === '/__files') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify([...r2.keys()])); return; }
  if (url.pathname === '/__dump') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(sqlite.prepare('SELECT * FROM docs ORDER BY rev').all())); return; }
  if (url.pathname === '/api/session') { res.setHeader('Content-Type', 'application/json'); res.end('{"email":"test"}'); return; }
  if (url.pathname === '/api/sync') {
    if (offline) { req.destroy(); return; }
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const request = new Request(url, { method: req.method, headers: req.headers, body: req.method === 'POST' ? Buffer.concat(chunks) : undefined });
    const fn = req.method === 'GET' ? sync.onRequestGet : req.method === 'POST' ? sync.onRequestPost : null;
    if (!fn) { res.statusCode = 405; res.end(); return; }
    try {
      const out = await fn({ request, env: { DB }, data: { user: { email: 'test' } } });
      res.statusCode = out.status;
      out.headers.forEach((v, k) => res.setHeader(k, v));
      res.end(Buffer.from(await out.arrayBuffer()));
    } catch (e) { res.statusCode = 500; res.end(String(e && e.stack || e)); }
    return;
  }
  if (url.pathname === '/api/files') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const hasBody = req.method === 'POST';
    const request = new Request(url, { method: req.method, headers: req.headers, body: hasBody ? Buffer.concat(chunks) : undefined });
    const fn = { GET: files.onRequestGet, POST: files.onRequestPost, DELETE: files.onRequestDelete }[req.method];
    if (!fn) { res.statusCode = 405; res.end(); return; }
    try {
      const out = await fn({ request, env: { DB, FILES }, data: { user: { email: 'test' } } });
      res.statusCode = out.status;
      out.headers.forEach((v, k) => res.setHeader(k, v));
      res.end(Buffer.from(await out.arrayBuffer()));
    } catch (e) { res.statusCode = 500; res.end(String(e && e.stack || e)); }
    return;
  }
  if (AI_ROUTES[url.pathname]) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const request = new Request(url, { method: req.method, headers: req.headers, body: req.method === 'POST' ? Buffer.concat(chunks) : undefined });
    const mod = AI_ROUTES[url.pathname];
    const fn = req.method === 'GET' ? mod.onRequestGet : req.method === 'POST' ? mod.onRequestPost : null;
    if (!fn) { res.statusCode = 405; res.end(); return; }
    try {
      const out = await fn({ request, env: { DB, AI, FILES, AI_DAILY_NEURONS: aiLimit, ...ocrEnv() }, data: { user: { email: 'test' } } });
      res.statusCode = out.status;
      out.headers.forEach((v, k) => res.setHeader(k, v));
      if (!out.body) { res.end(); return; }
      // สตรีมจริงทีละท่อน (ไม่รอครบก้อน) เพื่อให้ทดสอบ onToken ฝั่งเบราว์เซอร์ได้
      const reader = out.body.getReader();
      for (;;) { const { done, value } = await reader.read(); if (done) break; res.write(value); }
      res.end();
    } catch (e) { res.statusCode = 500; res.end(String(e && e.stack || e)); }
    return;
  }
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; res.end('not found'); return; }
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log('sync test server on ' + PORT));
