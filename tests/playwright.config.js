// @ts-check
const { defineConfig } = require('@playwright/test');
const path = require('path');

const PORT = 8123;
const ROOT = path.resolve(__dirname, '..');

module.exports = defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.js$/,
  timeout: 60000,
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  // baseline อยู่ใน tests/__screenshots__ (commit เข้า repo) — ชื่อไฟล์ไม่ผูกกับ OS เพราะ CI/เครื่องเจ้าของใช้ Linux Chromium เหมือนกัน
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' } },
  use: {
    baseURL: `http://localhost:${PORT}`,
    serviceWorkers: 'block',
    // Chromium ตัวเต็ม (new headless) ทั้งในเครื่องและบน CI — chromium-headless-shell ที่เป็นค่าเริ่มต้นวาดตัวอักษรไทยต่างกันเล็กน้อยจน baseline ไม่ตรง
    channel: 'chromium',
    timezoneId: 'Asia/Bangkok',
    locale: 'en-US',
  },
  webServer: [
    {
      command: `python3 -m http.server ${PORT}`,
      cwd: ROOT,
      url: `http://localhost:${PORT}/index.html`,
      reuseExistingServer: !process.env.CI,
    },
    {
      // sync.spec.js / migrate.spec.js: static + /api/sync ตัวจริงบน SQLite (node:sqlite)
      command: 'node --no-warnings sync-server.mjs 8124',
      cwd: __dirname,
      url: 'http://localhost:8124/index.html',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
