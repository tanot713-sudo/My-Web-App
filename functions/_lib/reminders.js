/* ตรรกะล้วนของการแจ้งเตือน (ไม่มี env/DB/fetch) — ใช้ร่วมกันใน functions/api/push/*, functions/_lib/scheduler.js
   (Scheduler Worker ที่ workers/scheduler/) และ tests/push.spec.js (import ตรง)
   ไม่มีไฟล์ไหนใน functions/_lib export onRequest* ⇒ Pages ไม่ถือเป็น route

   เวลา: due_at = epoch ms · "วัน" ของการแจ้งเตือนนับตามเวลาไทย (UTC+7 ไม่มีเวลาออมแสง) ไม่ใช่ UTC
   แถวในตาราง reminders (migrations/0001 + 0002):
     kind 'push'   = ส่งทีละรายการเมื่อถึง due_at (ประกัน/ภาษี) — ส่งแล้วตั้ง sent_at, repeat ≠ NULL เลื่อน due_at รอบถัดไป
     kind 'digest' = บรรทัดหนึ่งในสรุปประจำวัน 07:00 ของวันที่ due_at ตกอยู่ (บำรุงรักษา: 1 แถวต่อวัน ไม่ใช่ทีละเครื่อง) */

export const ICT_MS = 7 * 3600 * 1000;
export const DAY_MS = 86400000;
export const STALE_MS = 2 * DAY_MS;      // รายการ push ที่เลยเวลามานานกว่านี้ (scheduler ล่ม/เพิ่งลงทะเบียน) ไม่ส่งย้อนหลัง
export const MAX_ITEMS = 200;            // ต่อ scope ต่อครั้ง
export const KINDS = ['push', 'digest'];
export const REPEATS = ['daily', 'weekly', 'monthly', 'yearly'];

const pad = (n) => (n < 10 ? '0' : '') + n;

/** 'YYYY-MM-DD' ตามเวลาไทยของ ms */
export function ictDate(ms) {
  const d = new Date(ms + ICT_MS);
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
}

/** epoch ms ของ 00:00 เวลาไทยของวันที่ ms ตกอยู่ */
export function ictDayStart(ms) {
  return Math.floor((ms + ICT_MS) / DAY_MS) * DAY_MS - ICT_MS;
}

/** epoch ms ของวันที่ 'YYYY-MM-DD' เวลา hh:mm เวลาไทย */
export function ictAt(ymd, hh = 0, mm = 0) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], hh, mm) - ICT_MS;
}

/** รอบถัดไปของ repeat (นับตามปฏิทินไทย — วันที่ 31 ที่ไม่มีในเดือนถัดไปถอยเป็นวันสุดท้ายของเดือน) */
export function nextRepeat(dueAt, repeat) {
  if (repeat === 'daily') return dueAt + DAY_MS;
  if (repeat === 'weekly') return dueAt + 7 * DAY_MS;
  const months = repeat === 'monthly' ? 1 : repeat === 'yearly' ? 12 : 0;
  if (!months) return null;
  const d = new Date(dueAt + ICT_MS);
  const day = d.getUTCDate();
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(day, last));
  return t.getTime() - ICT_MS;
}

/** เลื่อน due_at ของรายการที่ repeat ไปรอบแรกที่ยังไม่ถึง (ข้ามรอบที่พลาดไปทั้งหมด ไม่ส่งซ้ำรัว) */
export function advance(dueAt, repeat, now) {
  let t = dueAt;
  for (let i = 0; i < 1000; i++) {
    t = nextRepeat(t, repeat);
    if (t == null || t > now) return t;
  }
  return null;
}

/** รายการ push ที่ถึงเวลาส่ง ณ now — send = ส่งจริง, stale = เลยมานานเกิน STALE_MS (ปิดโดยไม่ส่ง) */
export function pickDue(rows, now) {
  const send = [], stale = [];
  for (const r of rows || []) {
    if (!r || r.done || (r.kind || 'push') !== 'push' || r.sent_at != null) continue;
    if (!(r.due_at <= now)) continue;
    (now - r.due_at > STALE_MS ? stale : send).push(r);
  }
  send.sort((a, b) => a.due_at - b.due_at);
  return { send, stale };
}

/** สรุปประจำวัน ณ now: แถว digest ของ "วันนี้" ตามเวลาไทย → payload เดียว (null = วันนี้ไม่มีอะไรต้องบอก) */
export function digestFor(rows, now) {
  const today = ictDate(now);
  const items = (rows || []).filter((r) => r && !r.done && r.kind === 'digest' && ictDate(r.due_at) === today);
  if (!items.length) return null;
  items.sort((a, b) => String(a.source || '').localeCompare(String(b.source || '')) || String(a.id).localeCompare(String(b.id)));
  const lines = items.map((r) => (r.body ? r.title + ': ' + r.body : r.title));
  const urls = [...new Set(items.map((r) => r.url || 'index.html'))];
  return {
    title: 'สรุปประจำวัน',
    body: lines.join('\n'),
    url: urls.length === 1 ? urls[0] : 'index.html',
    tag: 'daily-' + today,
    ids: items.map((r) => r.id),
  };
}

/* ── ตรวจรายการที่หน้าเว็บส่งมาลงทะเบียน ── */
const SCOPE_RE = /^[a-z][a-z0-9-]{0,31}$/;
// URL ปลายทางต้องเป็นหน้าในเว็บเราเอง (ชื่อไฟล์ .html + query/hash) — กันลิงก์ออกนอกโดเมนในการแจ้งเตือน
const URL_RE = /^[a-z0-9][a-z0-9._-]*\.html(?:[?#][^\s]*)?$/i;

function str(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);
}

export function validScope(scope) { return SCOPE_RE.test(String(scope || '')); }
export function validUrl(url) { return URL_RE.test(String(url || '')) && String(url).length <= 300; }

/** แปลง items จากหน้าเว็บเป็นแถว reminders (id ขึ้นต้นด้วย scope:) — ทิ้งรายการที่ไม่ถูกรูปแบบ, คืน { rows, dropped } */
export function cleanItems(scope, items) {
  if (!validScope(scope)) throw new Error('scope');
  if (!Array.isArray(items)) throw new Error('items');
  if (items.length > MAX_ITEMS) throw new Error('too many');
  const rows = [], seen = new Set();
  let dropped = 0;
  for (const it of items) {
    const id = str(it && it.id, 160);
    const title = str(it && it.title, 120);
    const due = Number(it && it.due_at);
    const kind = KINDS.includes(it && it.kind) ? it.kind : 'push';
    const repeat = it && it.repeat != null && it.repeat !== '' ? it.repeat : null;
    const url = it && it.url ? String(it.url) : '';
    if (!id || !title || !Number.isFinite(due) || due <= 0 || (repeat && !REPEATS.includes(repeat)) || (url && !validUrl(url))) { dropped++; continue; }
    const full = scope + ':' + id;
    if (seen.has(full)) { dropped++; continue; }
    seen.add(full);
    rows.push({ id: full, title, body: str(it.body, 400) || null, url: url || null, due_at: Math.round(due), kind, repeat, source: scope });
  }
  return { rows, dropped };
}

/** ข้อความแจ้งเตือนต้องไม่เกินขนาด record ของ Web Push (4096 ไบต์หลังเข้ารหัส) — ตัดเนื้อหาให้ JSON ≤ ~3000 ไบต์ */
export function payloadOf(p) {
  const out = { title: str(p.title, 120) || 'Tanot', body: String(p.body || '').slice(0, 1200), url: p.url && validUrl(p.url) ? p.url : 'index.html', tag: str(p.tag, 64) || undefined };
  let s = JSON.stringify(out);
  while (new TextEncoder().encode(s).length > 3000 && out.body.length > 20) {
    out.body = out.body.slice(0, Math.floor(out.body.length * 0.8)) + '…';
    s = JSON.stringify(out);
  }
  return s;
}
