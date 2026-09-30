// เซิร์ฟเวอร์ทดสอบ Phase 1: เสิร์ฟไฟล์ static จาก root + รัน functions/api/sync.js ตัวจริง บน SQLite ของ Node (แทน D1)
// ใช้ schema จริงจาก migrations/*.sql — รัน: node sync-server.mjs [port]   (POST /__reset ล้างฐานข้อมูล, /__offline=1|0 จำลองเซิร์ฟเวอร์ล่ม)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = +(process.argv[2] || process.env.SYNC_PORT || 8124);
const sync = await import(pathToFileURL(path.join(ROOT, 'functions/api/sync.js')).href);

let sqlite;
function resetDb() {
  sqlite = new DatabaseSync(':memory:');
  for (const f of fs.readdirSync(path.join(ROOT, 'migrations')).sort()) sqlite.exec(fs.readFileSync(path.join(ROOT, 'migrations', f), 'utf8'));
}
resetDb();

// D1 shim: prepare().bind().all()/first()/run() + batch() (ทำใน transaction เดียวแบบ D1)
class Stmt {
  constructor(sql, params = []) { this.sql = sql; this.params = params; }
  bind(...p) { return new Stmt(this.sql, p); }
  _exec() {
    const st = sqlite.prepare(this.sql);
    const p = this.params.map((v) => (v === undefined ? null : v));
    const results = /^\s*select|returning/i.test(this.sql) ? st.all(...p) : (st.run(...p), []);
    return { results: results.map((r) => ({ ...r })), success: true };
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
  if (url.pathname === '/__reset') { resetDb(); res.end('ok'); return; }
  if (url.pathname === '/__offline') { offline = url.searchParams.get('v') === '1'; res.end('ok'); return; }
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
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; res.end('not found'); return; }
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log('sync test server on ' + PORT));
