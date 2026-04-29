/**
 * E2E 测试 - 截图捕获 (固定路径版本)
 */

import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// 固定截图目录
const SCREENSHOT_DIR = '/workspace/my-evo/frontend/.next/playwright/screenshots';

// 确保目录存在
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function injectAuth(page: Page) {
  void page.addInitScript(() => {
    window.localStorage.setItem("evomap-auth", JSON.stringify({
      state: { token: "mock-token-123", userId: "user-test-001", isAuthenticated: true },
      version: 0,
    }));
  });
}

async function captureScreenshot(page: Page, filename: string) {
  const filepath = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`Screenshot saved: ${filepath}`);
  return filepath;
}

test.describe('E2E 截图捕获', () => {
  
  test('TC01: 登录页面', async ({ page }) => {
    await page.goto('${BASE}/login');
    await page.waitForLoadState('networkidle');
    const filepath = await captureScreenshot(page, '01-login.png');
    expect(fs.existsSync(filepath)).toBeTruthy();
  });

  test('TC02: Dashboard 首页', async ({ page }) => {
    injectAuth(page);
    await page.goto('${BASE}/');
    await page.waitForLoadState('networkidle');
    const filepath = await captureScreenshot(page, '02-dashboard.png');
    expect(fs.existsSync(filepath)).toBeTruthy();
  });

  test('TC03: Browse 页面', async ({ page }) => {
    injectAuth(page);
    await page.route('**/a2a/assets*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], total: 0, page: 1, page_size: 20 }),
      });
    });
    await page.goto('${BASE}/browse');
    await page.waitForLoadState('networkidle');
    const filepath = await captureScreenshot(page, '03-browse.png');
    expect(fs.existsSync(filepath)).toBeTruthy();
  });

  test('TC04: Map Editor', async ({ page }) => {
    injectAuth(page);
    await page.goto('${BASE}/map');
    await page.waitForLoadState('networkidle');
    const filepath = await captureScreenshot(page, '04-map-editor.png');
    expect(fs.existsSync(filepath)).toBeTruthy();
  });

  test('TC05: Bounty Hall', async ({ page }) => {
    injectAuth(page);
    await page.goto('${BASE}/bounty-hall');
    await page.waitForLoadState('networkidle');
    const filepath = await captureScreenshot(page, '05-bounty-hall.png');
    expect(fs.existsSync(filepath)).toBeTruthy();
  });

  test('TC06: Arena', async ({ page }) => {
    injectAuth(page);
    await page.goto('${BASE}/arena');
    await page.waitForLoadState('networkidle');
    const filepath = await captureScreenshot(page, '06-arena.png');
    expect(fs.existsSync(filepath)).toBeTruthy();
  });

  test('TC07: Marketplace', async ({ page }) => {
    injectAuth(page);
    await page.goto('${BASE}/marketplace');
    await page.waitForLoadState('networkidle');
    const filepath = await captureScreenshot(page, '07-marketplace.png');
    expect(fs.existsSync(filepath)).toBeTruthy();
  });

  test('TC08: Profile', async ({ page }) => {
    injectAuth(page);
    await page.goto('${BASE}/profile');
    await page.waitForLoadState('networkidle');
    const filepath = await captureScreenshot(page, '08-profile.png');
    expect(fs.existsSync(filepath)).toBeTruthy();
  });

  test('TC09: Onboarding', async ({ page }) => {
    injectAuth(page);
    await page.goto('${BASE}/onboarding');
    await page.waitForLoadState('networkidle');
    const filepath = await captureScreenshot(page, '09-onboarding.png');
    expect(fs.existsSync(filepath)).toBeTruthy();
  });

  test('TC10: Swarm', async ({ page }) => {
    injectAuth(page);
    await page.goto('${BASE}/swarm');
    await page.waitForLoadState('networkidle');
    const filepath = await captureScreenshot(page, '10-swarm.png');
    expect(fs.existsSync(filepath)).toBeTruthy();
  });
});
