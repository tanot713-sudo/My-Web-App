// GitHub Pages แบบ redirect อย่างเดียว (.github/scripts/github-pages-redirect.mjs)
// เสิร์ฟผลลัพธ์ภายใต้ https://tanot713-sudo.github.io/My-Web-App/ ปลอม แล้วดูว่าแต่ละ URL ไปลงที่ pages.dev ตรงหน้า
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');

const GH = 'https://tanot713-sudo.github.io/My-Web-App/';
let OUT, mod;

test.beforeAll(async () => {
  mod = await import(path.join(__dirname, '..', '.github', 'scripts', 'github-pages-redirect.mjs'));
  OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'gh-redirect-'));
  mod.build(OUT);
});
test.afterAll(() => { fs.rmSync(OUT, { recursive: true, force: true }); });

async function serve(page) {
  await page.route('https://tanot713-sudo.github.io/**', (route) => {
    const u = new URL(route.request().url());
    let rel = decodeURIComponent(u.pathname.replace(/^\/My-Web-App\/?/i, ''));
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    const file = path.join(OUT, rel);
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
      const type = rel.endsWith('.js') ? 'text/javascript' : rel.endsWith('.css') ? 'text/css' : rel.endsWith('.svg') ? 'image/svg+xml' : 'text/html';
      return route.fulfill({ status: 200, contentType: type, body: fs.readFileSync(file) });
    }
    return route.fulfill({ status: 404, contentType: 'text/html', body: fs.readFileSync(path.join(OUT, '404.html')) });
  });
  await page.route(mod.TARGET + '/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>pages.dev</p>' }));
}

async function landsOn(page, from, to) {
  await page.goto(from);
  await page.waitForURL(to);
  expect(page.url()).toBe(to);
}

test('หน้า .html → หน้าเดียวกันบน pages.dev พร้อม query/hash', async ({ page }) => {
  await serve(page);
  await landsOn(page, GH + 'tax.html?y=2569#plan', mod.TARGET + '/tax?y=2569#plan');
  await landsOn(page, GH + 'budget.html', mod.TARGET + '/budget');
});

test('หน้าแรกและ path ที่ไม่มีไฟล์ (404) ไปถูกที่', async ({ page }) => {
  await serve(page);
  await landsOn(page, GH, mod.TARGET + '/');
  await landsOn(page, GH + 'excel-work/', mod.TARGET + '/excel');
  await landsOn(page, GH + 'word-work', mod.TARGET + '/word');
  await landsOn(page, GH + 'tool/est-cost/index.html?x=1', mod.TARGET + '/tool/est-cost/?x=1');
});

test('migrate-export.html ยังทำงานจริงบน github.io (ไม่ redirect)', async ({ page }) => {
  await serve(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(GH + 'migrate-export.html');
  await page.waitForTimeout(500);
  expect(page.url()).toBe(GH + 'migrate-export.html');
  await expect(page.locator('#mxStatus')).toBeVisible();
  expect(errors).toEqual([]);
});

test('ทุกหน้า .html ของเว็บมีหน้า redirect และ sw.js ถอนการติดตั้งตัวเอง', () => {
  const root = path.join(__dirname, '..');
  const pages = fs.readdirSync(root).filter((f) => f.endsWith('.html'));
  for (const f of pages) expect(fs.existsSync(path.join(OUT, f)), f).toBe(true);
  const sw = fs.readFileSync(path.join(OUT, 'sw.js'), 'utf8');
  expect(sw).toContain('registration.unregister()');
  expect(sw).toContain('caches.delete');
});
