/**
 * E2E 测试 - 核心页面截图捕获
 */

import { test, expect, Page } from '@playwright/test';
import * as path from 'path';

const screenshotDir = path.join(__dirname, '../../.next/playwright/screenshots');

function injectAuth(page: Page) {
  void page.addInitScript(() => {
    window.localStorage.setItem("evomap-auth", JSON.stringify({
      state: { token: "mock-token-123", userId: "user-test-001", isAuthenticated: true },
      version: 0,
    }));
  });
}

test.describe('核心页面 E2E 测试', () => {
  
  test('登录页面', async ({ page }) => {
    await page.goto('http://127.0.0.1:3002/login');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(screenshotDir, '01-login-page.png'), fullPage: false });
    // 验证页面加载
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('首页 Dashboard', async ({ page }) => {
    injectAuth(page);
    await page.goto('http://127.0.0.1:3002/');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(screenshotDir, '02-dashboard-home.png'), fullPage: true });
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('Browse 页面', async ({ page }) => {
    injectAuth(page);
    await page.route('**/a2a/assets*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], total: 0, page: 1, page_size: 20 }),
      });
    });
    await page.goto('http://127.0.0.1:3002/browse');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(screenshotDir, '03-browse-page.png'), fullPage: true });
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('Map Editor 页面', async ({ page }) => {
    injectAuth(page);
    await page.goto('http://127.0.0.1:3002/map');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(screenshotDir, '04-map-editor.png'), fullPage: true });
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('Bounty Hall 页面', async ({ page }) => {
    injectAuth(page);
    await page.goto('http://127.0.0.1:3002/bounty-hall');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(screenshotDir, '05-bounty-hall.png'), fullPage: true });
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('Arena 页面', async ({ page }) => {
    injectAuth(page);
    await page.goto('http://127.0.0.1:3002/arena');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(screenshotDir, '06-arena-page.png'), fullPage: true });
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('Onboarding 页面', async ({ page }) => {
    injectAuth(page);
    await page.goto('http://127.0.0.1:3002/onboarding');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(screenshotDir, '07-onboarding.png'), fullPage: true });
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('Marketplace 页面', async ({ page }) => {
    injectAuth(page);
    await page.goto('http://127.0.0.1:3002/marketplace');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(screenshotDir, '08-marketplace.png'), fullPage: true });
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('Profile 页面', async ({ page }) => {
    injectAuth(page);
    await page.goto('http://127.0.0.1:3002/profile');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(screenshotDir, '09-profile.png'), fullPage: true });
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('Swarm 页面', async ({ page }) => {
    injectAuth(page);
    await page.goto('http://127.0.0.1:3002/swarm');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(screenshotDir, '10-swarm-page.png'), fullPage: true });
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});
