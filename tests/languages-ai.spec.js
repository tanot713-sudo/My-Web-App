// @ts-check
// หน้า languages: แชท AI ของโหมดเขียนใช้คลาวด์ก่อน แล้วถอยไปโมเดลในเครื่องเมื่อ canFallback และไม่ใช่ iOS (ROADMAP แถว 19)
const { test, expect } = require('@playwright/test');
const { prepare } = require('./helpers');

const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

async function setup(page, mode) {
  const errors = await prepare(page);
  const chatCalls = [];
  await page.addInitScript(() => {
    window.TANOT_AI = { enabled: true };
    window.__workers = [];
    const W = window.Worker;
    window.Worker = function (url, o) {
      window.__workers.push(String(url));
      if (/ai-chat-worker/.test(String(url))) {
        // โมเดลในเครื่องหลอก: ตอบ token แล้ว done
        const l = {};
        return {
          addEventListener(t, f) { (l[t] = l[t] || []).push(f); },
          removeEventListener(t, f) { l[t] = (l[t] || []).filter((x) => x !== f); },
          postMessage(m) { setTimeout(() => { (l.message || []).slice().forEach((f) => f({ data: { type: 'token', jobId: m.jobId, token: 'LOCAL-ANSWER' } })); (l.message || []).slice().forEach((f) => f({ data: { type: 'done', jobId: m.jobId } })); }, 10); },
          terminate() {},
        };
      }
      return new W(url, o);
    };
  });
  await page.route('**/api/ai/chat', (route) => {
    chatCalls.push(JSON.parse(route.request().postData() || '{}'));
    if (mode === 'ok') return route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'data: {"t":"CLOUD-"}\n\ndata: {"t":"ANSWER"}\n\ndata: {"done":true}\n\n' });
    if (mode === 'quota') return route.fulfill({ status: 429, contentType: 'application/json', body: '{"code":"quota"}' });
    return route.fulfill({ status: 502, contentType: 'application/json', body: '{"code":"upstream"}' });
  });
  return { errors, chatCalls };
}

async function submitCompose(page) {
  await page.goto('/languages.html');
  await page.click('[data-k="tab-writing"]');
  const sub = page.locator('[data-k="sub-compose"]');
  if (await sub.count()) await sub.click();
  await page.locator('textarea').first().fill('hello world');
  await page.click('[data-k="aiSubmit"]');
}

test('คลาวด์ตอบ → ใช้ผลคลาวด์ ไม่สร้าง Worker โมเดลในเครื่อง', async ({ page }) => {
  const { errors, chatCalls } = await setup(page, 'ok');
  await submitCompose(page);
  await expect(page.getByText('CLOUD-ANSWER')).toBeVisible();
  expect(chatCalls.length).toBe(1);
  expect(chatCalls[0].model).toBe('main');
  expect(await page.evaluate(() => window.__workers.filter((u) => /ai-chat-worker/.test(u)).length)).toBe(0);
  expect(errors).toEqual([]);
});

test('คลาวด์ล่มบนคอม → ถอยไปโมเดลในเครื่อง', async ({ page }) => {
  const { chatCalls } = await setup(page, 'down');
  await submitCompose(page);
  await expect(page.getByText('LOCAL-ANSWER')).toBeVisible();
  expect(chatCalls.length).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__workers.filter((u) => /ai-chat-worker/.test(u)).length)).toBe(1);
});

test.describe('iOS', () => {
  test.use({ userAgent: IOS_UA });
  test('โควตาเต็ม → ไม่ถอย แสดงข้อความของ AiClient', async ({ page }) => {
    await setup(page, 'quota');
    await submitCompose(page);
    await expect(page.getByText('โควตา AI ฟรีของวันนี้เต็มแล้ว')).toBeVisible();
    expect(await page.evaluate(() => window.__workers.filter((u) => /ai-chat-worker/.test(u)).length)).toBe(0);
  });
});
