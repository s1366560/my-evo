/**
 * E2E 测试 - 截图捕获验证
 * 
 * 覆盖核心页面:
 * - 登录页面
 * - Browse 页面
 * - Map Editor 页面
 * - 截图保存到本地
 */

import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Auth Helper
function injectAuth(page: Page) {
  void page.addInitScript(() => {
    window.localStorage.setItem("evomap-auth", JSON.stringify({
      state: { token: "mock-token-123", userId: "user-test-001", isAuthenticated: true },
      version: 0,
    }));
  });
}

// Mock 数据
const mockAssets = [
  { asset_id: "asset_001", name: "Context Manager Pattern", type: "capsule", description: "Advanced context management", gdi: 85.5 },
  { asset_id: "asset_002", name: "Async Context Handler", type: "gene", description: "Async context utilities", gdi: 82.3 },
  { asset_id: "asset_003", name: "Data Context Store", type: "capsule", description: "State management with context", gdi: 80.1 },
];

const screenshotDir = path.join(__dirname, '../../.next/playwright/screenshots');

// 确保截图目录存在
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

test.describe('E2E 截图捕获测试', () => {
  
  /**
   * TC1: 登录页面截图
   */
  test('TC1: 登录页面截图验证', async ({ page }) => {
    await page.goto('${BASE}/auth');
    await page.waitForLoadState('networkidle');
    
    // 截图
    await page.screenshot({ 
      path: path.join(screenshotDir, 'auth-login-page.png'),
      fullPage: false 
    });
    
    // 验证页面元素
    const loginForm = page.locator('form, [data-testid="login-form"], button:has-text("Sign"), button:has-text("登录")');
    await expect(loginForm.first()).toBeVisible({ timeout: 5000 });
  });

  /**
   * TC2: Browse 页面截图
   */
  test('TC2: Browse 页面截图验证', async ({ page }) => {
    injectAuth(page);
    
    // Mock API
    await page.route('**/a2a/assets*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: mockAssets,
          total: 3,
          page: 1,
          page_size: 20,
        }),
      });
    });

    await page.goto('${BASE}/browse');
    await page.waitForLoadState('networkidle');
    
    // 截图
    await page.screenshot({ 
      path: path.join(screenshotDir, 'browse-page.png'),
      fullPage: false 
    });
    
    // 验证页面加载
    const assetCards = page.locator('[data-testid="asset-card"], .asset-card, [class*="asset"]');
    await expect(assetCards.first()).toBeVisible({ timeout: 10000 });
  });

  /**
   * TC3: Map Editor 页面截图
   */
  test('TC3: Map Editor 页面截图验证', async ({ page }) => {
    injectAuth(page);
    
    await page.goto('http://127.0.0.1:3002/map/new');
    await page.waitForLoadState('networkidle');
    
    // 截图
    await page.screenshot({ 
      path: path.join(screenshotDir, 'map-editor-page.png'),
      fullPage: false 
    });
    
    // 验证编辑器加载 - 查找画布区域
    const editor = page.locator('[data-testid="map-editor"], .map-editor, [class*="editor"]');
    await expect(editor.first()).toBeVisible({ timeout: 5000 });
  });

  /**
   * TC4: 首页/Dashboard 截图
   */
  test('TC4: 首页截图验证', async ({ page }) => {
    injectAuth(page);
    
    await page.goto('http://127.0.0.1:3002/');
    await page.waitForLoadState('networkidle');
    
    // 截图
    await page.screenshot({ 
      path: path.join(screenshotDir, 'dashboard-home.png'),
      fullPage: false 
    });
    
    // 验证页面加载
    const mainContent = page.locator('main, [data-testid="main"], body');
    await expect(mainContent.first()).toBeVisible({ timeout: 5000 });
  });

  /**
   * TC5: 错误页面截图
   */
  test('TC5: 404 错误页面截图', async ({ page }) => {
    await page.goto('http://127.0.0.1:3002/nonexistent-page-xyz');
    await page.waitForLoadState('networkidle');
    
    // 截图
    await page.screenshot({ 
      path: path.join(screenshotDir, 'error-404-page.png'),
      fullPage: false 
    });
  });

  /**
   * TC6: 完整页面滚动截图
   */
  test('TC6: Browse 完整页面截图', async ({ page }) => {
    injectAuth(page);
    
    // Mock API
    await page.route('**/a2a/assets*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: mockAssets,
          total: 3,
          page: 1,
          page_size: 20,
        }),
      });
    });

    await page.goto('${BASE}/browse');
    await page.waitForLoadState('networkidle');
    
    // 完整页面截图
    await page.screenshot({ 
      path: path.join(screenshotDir, 'browse-fullpage.png'),
      fullPage: true 
    });
  });
});
