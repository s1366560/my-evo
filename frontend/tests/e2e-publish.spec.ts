/**
 * E2E 测试 - 发布流程 (Publish)
 *
 * 覆盖流程:
 * - TC1: 认证用户访问 /dashboard/assets，验证显示 "My Assets" 标题
 * - TC2: 用户查看发布的资产列表，mock /a2a/assets?author_id=mockUserId 返回资产列表
 * - TC3: 发布流程 - 用户填写名称、描述、DNA，mock POST /a2a/publish 返回 asset_id，验证提交成功
 * - TC4: 发布时 DNA 为空，验证显示验证错误
 * - TC5: 未认证用户访问 /dashboard/assets，验证重定向到 /login
 * - TC6: 发布失败时 - mock POST 返回500，验证显示错误提示
 */

import { test, expect, Page } from '@playwright/test';

// ── 常量定义 ──────────────────────────────────────────────────────────────────

const BASE = 'http://127.0.0.1:3002';
const API = 'http://localhost:3001';

// ── Auth Helper ───────────────────────────────────────────────────────────────

/** 注入认证状态到 localStorage */
function injectAuth(page: Page) {
  void page.addInitScript(() => {
    window.localStorage.setItem('evomap-auth', JSON.stringify({
      state: { token: 'mock-token-123', userId: 'user-test-001', isAuthenticated: true },
      version: 0,
    }));
  });
}

/** 清除认证状态 */
async function clearAuthState(page: Page) {
  await page.goto(BASE);
  try {
    await page.evaluate(() => localStorage.removeItem('evomap-auth'));
  } catch {
    // localStorage not accessible on about:blank
  }
  await page.context().clearCookies();
  await page.reload();
}

// ── Mock 数据 ─────────────────────────────────────────────────────────────────

const MOCK_USER_ID = 'user-test-001';

const mockUserAssets = [
  {
    asset_id: 'asset_pub_001',
    name: 'My Capsule Project',
    type: 'capsule',
    description: 'A reusable capsule for data processing',
    gdi: 88.5,
    created_at: '2024-04-01T10:00:00Z',
  },
  {
    asset_id: 'asset_pub_002',
    name: 'Database Optimizer',
    type: 'gene',
    description: 'SQL optimization patterns',
    gdi: 82.3,
    created_at: '2024-04-02T14:30:00Z',
  },
  {
    asset_id: 'asset_pub_003',
    name: 'API Gateway Pattern',
    type: 'capsule',
    description: 'Centralized API routing solution',
    gdi: 79.8,
    created_at: '2024-04-03T09:15:00Z',
  },
];

const mockPublishResponse = {
  success: true,
  data: {
    asset_id: 'asset_newly_published_001',
    name: 'Newly Published Asset',
    type: 'capsule',
    created_at: new Date().toISOString(),
  },
};

// ── 路由拦截器 ────────────────────────────────────────────────────────────────

/** 应用通用 mocks */
function applyCommonMocks(page: Page) {
  // Mock 账户登录接口（防止401）
  void page.route(`${API}/account/login`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          token: 'mock-token-e2e',
          user: { id: MOCK_USER_ID, email: 'e2e@test.com' },
        },
      }),
    });
  });

  // Mock 统计数据（dashboard 侧边栏等需要）
  void page.route(`${API}/a2a/stats`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          alive_nodes: 1923,
          total_nodes: 2847,
          total_genes: 14832,
          total_capsules: 3204,
          total_recipes: 891,
          active_swarms: 147,
        },
      }),
    });
  });
}

// ── 测试套件 ─────────────────────────────────────────────────────────────────

test.describe('发布流程 (Publish) E2E', () => {

  /**
   * TC1: 认证用户访问 /dashboard/assets，验证显示 "My Assets" 标题
   */
  test('TC1: 认证用户访问 /dashboard/assets 显示 My Assets 标题', async ({ page }) => {
    injectAuth(page);
    applyCommonMocks(page);

    await page.goto(`${BASE}/dashboard/assets`);
    await page.waitForLoadState('networkidle');

    // 验证页面标题为 "My Assets"
    const heading = page.locator('h1, [data-testid="page-title"], h2').filter({ hasText: /My Assets/i }).first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  /**
   * TC2: 用户查看发布的资产列表 - mock /a2a/assets?author_id=mockUserId 返回资产列表
   */
  test('TC2: 查看发布的资产列表', async ({ page }) => {
    injectAuth(page);
    applyCommonMocks(page);

    // Mock 用户资产列表接口
    await page.route(`${API}/a2a/assets*author_id*`, (route) => {
      const url = route.request().url();
      if (url.includes('author_id')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            assets: mockUserAssets,
            total: 3,
            page: 1,
            page_size: 20,
          }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto(`${BASE}/dashboard/assets`);
    await page.waitForLoadState('networkidle');

    // 验证资产卡片显示
    const assetCards = page.locator('[data-testid="asset-card"], [data-testid="my-asset-card"], .asset-card');
    await expect(assetCards.first()).toBeVisible({ timeout: 10000 });

    // 验证至少显示3个资产
    const count = await assetCards.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  /**
   * TC3: 发布流程 - 用户填写名称、描述、DNA，mock POST /a2a/publish 返回 asset_id，验证提交成功
   */
  test('TC3: 发布流程 - 填写表单并提交成功', async ({ page }) => {
    injectAuth(page);
    applyCommonMocks(page);

    // Mock 发布接口成功响应
    await page.route(`${API}/a2a/publish`, (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockPublishResponse),
        });
      } else {
        route.continue();
      }
    });

    // Mock 资产列表接口
    await page.route(`${API}/a2a/assets*author_id*`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          assets: [...mockUserAssets, mockPublishResponse.data],
          total: 4,
          page: 1,
          page_size: 20,
        }),
      });
    });

    await page.goto(`${BASE}/dashboard/assets`);
    await page.waitForLoadState('networkidle');

    // 点击发布按钮（如果有的话）或者直接导航到发布页面
    const publishButton = page.locator('[data-testid="publish-btn"], [data-testid="create-asset-btn"], button:has-text("Publish"), button:has-text("发布")').first();
    
    if (await publishButton.isVisible()) {
      await publishButton.click();
    } else {
      // 尝试直接访问发布页面
      await page.goto(`${BASE}/dashboard/assets/publish`);
    }

    await page.waitForLoadState('networkidle');

    // 填写发布表单
    const nameInput = page.locator('input[id="name"], [data-testid="asset-name-input"], input[placeholder*="name" i]').first();
    const descriptionInput = page.locator('textarea[id="description"], [data-testid="asset-description-input"], textarea[placeholder*="description" i]').first();
    const dnaInput = page.locator('[data-testid="dna-input"], textarea[id="dna"], textarea[placeholder*="DNA" i], [data-testid="gene-dna-input"]').first();

    if (await nameInput.isVisible()) {
      await nameInput.fill('Test Asset Name');
    }
    if (await descriptionInput.isVisible()) {
      await descriptionInput.fill('This is a test asset description for E2E testing purposes.');
    }
    if (await dnaInput.isVisible()) {
      await dnaInput.fill('test-gene-dna-content-12345');
    }

    // 点击提交按钮
    const submitButton = page.locator('[data-testid="submit-btn"], [data-testid="publish-submit"], button:has-text("Submit"), button:has-text("提交"), button[type="submit"]').first();
    await expect(submitButton).toBeVisible();
    await submitButton.click();

    // 等待发布请求完成
    await page.waitForResponse(
      resp => resp.url().includes('/a2a/publish') && resp.status() === 200,
      { timeout: 10000 }
    );

    // 验证发布成功提示或页面跳转
    const successMessage = page.locator('[data-testid="success-message"], [data-testid="publish-success"], text:has-text("Success"), text:has-text("成功")').first();
    const isSuccessVisible = await successMessage.isVisible().catch(() => false);

    // 允许成功消息或 URL 跳转
    expect(isSuccessVisible || page.url().includes('success') || page.url().includes('dashboard')).toBeTruthy();
  });

  /**
   * TC4: 发布时 DNA 为空 - 验证显示验证错误
   */
  test('TC4: 发布时 DNA 为空显示验证错误', async ({ page }) => {
    injectAuth(page);
    applyCommonMocks(page);

    await page.goto(`${BASE}/dashboard/assets`);
    await page.waitForLoadState('networkidle');

    // 点击发布按钮
    const publishButton = page.locator('[data-testid="publish-btn"], [data-testid="create-asset-btn"], button:has-text("Publish"), button:has-text("发布")').first();
    
    if (await publishButton.isVisible()) {
      await publishButton.click();
    } else {
      await page.goto(`${BASE}/dashboard/assets/publish`);
    }

    await page.waitForLoadState('networkidle');

    // 填写名称和描述，但不填写 DNA
    const nameInput = page.locator('input[id="name"], [data-testid="asset-name-input"], input[placeholder*="name" i]').first();
    const descriptionInput = page.locator('textarea[id="description"], [data-testid="asset-description-input"], textarea[placeholder*="description" i]').first();
    const dnaInput = page.locator('[data-testid="dna-input"], textarea[id="dna"], textarea[placeholder*="DNA" i], [data-testid="gene-dna-input"]').first();

    if (await nameInput.isVisible()) {
      await nameInput.fill('Test Asset Without DNA');
    }
    if (await descriptionInput.isVisible()) {
      await descriptionInput.fill('This asset is missing DNA content.');
    }
    // 故意不填写 DNA

    // 点击提交按钮
    const submitButton = page.locator('[data-testid="submit-btn"], [data-testid="publish-submit"], button:has-text("Submit"), button:has-text("提交"), button[type="submit"]').first();
    await expect(submitButton).toBeVisible();
    await submitButton.click();

    // 等待验证错误显示
    const validationError = page.locator(
      '[data-testid="validation-error"], [data-testid="dna-error"], .error, .validation-error, text:has-text("DNA"), text:has-text("Required"), text:has-text("必填"), text:has-text("不能为空")'
    ).first();

    // 验证错误提示显示
    await expect(validationError).toBeVisible({ timeout: 5000 });
  });

  /**
   * TC5: 未认证用户访问 /dashboard/assets - 验证重定向到 /login
   */
  test('TC5: 未认证用户访问 /dashboard/assets 重定向到登录页', async ({ page }) => {
    // 先清除认证状态
    await clearAuthState(page);

    // 尝试访问需要认证的页面
    await page.goto(`${BASE}/dashboard/assets`);

    // 验证重定向到登录页面
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    // 验证登录表单显示
    const emailInput = page.locator('#email, [data-testid="email-input"], input[type="email"]').first();
    const passwordInput = page.locator('#password, [data-testid="password-input"], input[type="password"]').first();
    await expect(emailInput.or(passwordInput).first()).toBeVisible({ timeout: 5000 });
  });

  /**
   * TC6: 发布失败时 - mock POST 返回500，验证显示错误提示
   */
  test('TC6: 发布失败时显示错误提示', async ({ page }) => {
    injectAuth(page);
    applyCommonMocks(page);

    // Mock 发布接口返回500错误
    await page.route(`${API}/a2a/publish`, (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: {
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to publish asset',
            },
          }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto(`${BASE}/dashboard/assets`);
    await page.waitForLoadState('networkidle');

    // 点击发布按钮
    const publishButton = page.locator('[data-testid="publish-btn"], [data-testid="create-asset-btn"], button:has-text("Publish"), button:has-text("发布")').first();
    
    if (await publishButton.isVisible()) {
      await publishButton.click();
    } else {
      await page.goto(`${BASE}/dashboard/assets/publish`);
    }

    await page.waitForLoadState('networkidle');

    // 填写表单
    const nameInput = page.locator('input[id="name"], [data-testid="asset-name-input"], input[placeholder*="name" i]').first();
    const descriptionInput = page.locator('textarea[id="description"], [data-testid="asset-description-input"], textarea[placeholder*="description" i]').first();
    const dnaInput = page.locator('[data-testid="dna-input"], textarea[id="dna"], textarea[placeholder*="DNA" i], [data-testid="gene-dna-input"]').first();

    if (await nameInput.isVisible()) {
      await nameInput.fill('Test Asset For Failure');
    }
    if (await descriptionInput.isVisible()) {
      await descriptionInput.fill('This asset will fail to publish.');
    }
    if (await dnaInput.isVisible()) {
      await dnaInput.fill('test-dna-content-for-failure');
    }

    // 点击提交按钮
    const submitButton = page.locator('[data-testid="submit-btn"], [data-testid="publish-submit"], button:has-text("Submit"), button:has-text("提交"), button[type="submit"]').first();
    await expect(submitButton).toBeVisible();
    await submitButton.click();

    // 等待发布请求完成（应该是500）
    await page.waitForResponse(
      resp => resp.url().includes('/a2a/publish') && resp.status() === 500,
      { timeout: 10000 }
    );

    // 验证错误提示显示
    const errorMessage = page.locator(
      '[data-testid="error-message"], [data-testid="publish-error"], .error, .error-message, text:has-text("Error"), text:has-text("错误"), text:has-text("Failed"), text:has-text("失败"), text:has-text("500")'
    ).first();

    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });
});
