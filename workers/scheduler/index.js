/* Tanot Scheduler Worker — ROADMAP 0a ข้อ 6 (Pages Functions ตั้ง cron ไม่ได้ จึงแยกเป็น Worker ตัวนี้)
   ทุก 15 นาที           → runTick: ส่ง Web Push ของการแจ้งเตือนที่ถึงเวลา (ตาราง reminders kind 'push')
   00:00 UTC (07:00 ไทย) → runDaily: สรุปประจำวัน (kind 'digest' ของวันนี้) + ล้างแถวเก่า + สำรอง D1 → R2 backups/d1/
   ใช้ D1 tanot-db / R2 tanot-files ตัวเดียวกับ Pages (wrangler.toml ในโฟลเดอร์นี้) · ตรรกะทั้งหมดอยู่ใน functions/_lib/ (เทสต์ใน tests/push.spec.js)
   ไม่มี URL สาธารณะ (workers_dev = false) — fetch ตอบ 404 เสมอ */
import { runTick, runDaily } from '../../functions/_lib/scheduler.js';

export const DAILY_CRON = '0 0 * * *';

export default {
  async scheduled(event, env, ctx) {
    const now = event.scheduledTime || Date.now();
    const out = event.cron === DAILY_CRON ? await runDaily(env, now) : await runTick(env, now);
    console.log(event.cron, JSON.stringify(out));
  },
  async fetch() {
    return new Response('Not found', { status: 404 });
  },
};
