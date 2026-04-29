/**
 * E2E 测试：Marketplace 资产市场页面
 *
 * 覆盖流程：
 * 1. 用户浏览 marketplace 资产列表，验证卡片渲染
 * 2. 用户按资产类型（Gene/Capsule/Recipe）筛选
 * 3. 用户按价格范围筛选
 * 4. 用户点击资产卡片，验证路由跳转
 * 5. API 返回空列表时显示空状态提示
 * 6. API 返回错误时显示错误提示
 */

import { test, expect, type Page } from "@playwright/test";

// ── Shared constants ────────────────────────────────────────────────────────────

const BASE = "http://127.0.0.1:3002";
const API = "http://127.0.0.1:8001";

// ── Shared mock data ───────────────────────────────────────────────────────────

const mockListings = [
  {
    listing_id: "l1",
    asset_id: "sha256:asset1",
    asset_name: "context-scheduler",
    asset_type: "Capsule",
    price: 25,
    seller: "node-alpha",
    gdi_score: 70,
  },
  {
    listing_id: "l2",
    asset_id: "sha256:asset2",
    asset_name: "sql-optimize",
    asset_type: "Gene",
    price: 15,
    seller: "node-beta",
    gdi_score: 68,
  },
  {
    listing_id: "l3",
    asset_id: "sha256:asset3",
    asset_name: "api-gateway",
    asset_type: "Recipe",
    price: 80,
    seller: "node-gamma",
    gdi_score: 75,
  },
];

// ── Auth helper ────────────────────────────────────────────────────────────────

/** Inject authenticated state into localStorage before page navigation */
function injectAuth(page: Page) {
  void page.addInitScript(() => {
    window.localStorage.setItem(
      "evomap-auth",
      JSON.stringify({
        state: {
          token: "mock-token-123",
          userId: "user-test-001",
          isAuthenticated: true,
        },
        version: 0,
      })
    );
  });
}

// ── Route interceptors ─────────────────────────────────────────────────────────

/** Apply marketplace listings mock for a given page */
function applyListingsMock(page: Page, items = mockListings) {
  void page.route(`${API}/api/v2/marketplace/listings`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: { items } }),
    });
  });
}

/** Apply empty listings mock */
function applyEmptyListingsMock(page: Page) {
  void page.route(`${API}/api/v2/marketplace/listings`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: { items: [] } }),
    });
  });
}

/** Apply error mock for marketplace listings API */
function applyErrorMock(page: Page) {
  void page.route(`${API}/api/v2/marketplace/listings`, async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ success: false, error: "Internal server error" }),
    });
  });
}

// ── Test suite ─────────────────────────────────────────────────────────────────

test.describe("Marketplace E2E", () => {
  test.beforeEach(async ({ page }) => {
    injectAuth(page);
  });

  // TC1: 用户浏览 marketplace 资产列表
  test("TC1: 用户浏览 marketplace 资产列表 - 显示3个资产卡片", async ({ page }) => {
    applyListingsMock(page);

    await page.goto(`${BASE}/marketplace`);

    // 等待页面标题
    await expect(page.getByRole("heading", { name: "Asset Marketplace" })).toBeVisible();

    // 等待卡片加载完成（骨架屏消失后）
    await expect(page.locator('[data-testid="asset-listing-card"]')).toHaveCount(3, {
      timeout: 10000,
    });

    // 验证各资产名称显示
    await expect(page.getByText("context-scheduler")).toBeVisible();
    await expect(page.getByText("sql-optimize")).toBeVisible();
    await expect(page.getByText("api-gateway")).toBeVisible();

    // 验证价格显示
    await expect(page.getByText(/25 credits/i)).toBeVisible();
    await expect(page.getByText(/15 credits/i)).toBeVisible();
    await expect(page.getByText(/80 credits/i)).toBeVisible();
  });

  // TC2: 用户筛选 Gene 类型
  test("TC2: 用户筛选 Gene 类型 - 列表正确过滤", async ({ page }) => {
    applyListingsMock(page);

    await page.goto(`${BASE}/marketplace`);
    await expect(page.locator('[data-testid="asset-listing-card"]')).toHaveCount(3, {
      timeout: 10000,
    });

    // 取消 Capsule 和 Recipe 筛选，仅保留 Gene
    // 查找 Gene checkbox 并勾选
    const geneCheckbox = page.getByLabel("Gene");
    if (await geneCheckbox.isChecked()) {
      // Gene 已选中，取消其他两个
      await page.getByLabel("Capsule").uncheck();
      await page.getByLabel("Recipe").uncheck();
    } else {
      // 全部取消再选中 Gene
      await page.getByLabel("Capsule").uncheck();
      await page.getByLabel("Recipe").uncheck();
      await geneCheckbox.check();
    }

    // 验证仅显示 Gene 类型
    await expect(page.locator('[data-testid="asset-listing-card"]')).toHaveCount(1, {
      timeout: 5000,
    });
    await expect(page.getByText("sql-optimize")).toBeVisible();
    await expect(page.getByText("Gene")).toBeVisible();
  });

  // TC3: 用户筛选价格范围 [0, 50]
  test("TC3: 用户筛选价格范围 [0, 50] - 列表正确过滤", async ({ page }) => {
    applyListingsMock(page);

    await page.goto(`${BASE}/marketplace`);
    await expect(page.locator('[data-testid="asset-listing-card"]')).toHaveCount(3, {
      timeout: 10000,
    });

    // 设置价格范围 min=0, max=50
    const minInput = page.locator('[data-testid="price-min-input"]');
    const maxInput = page.locator('[data-testid="price-max-input"]');

    await minInput.clear();
    await minInput.fill("0");
    await maxInput.clear();
    await maxInput.fill("50");

    // 验证过滤结果：context-scheduler (25) 和 sql-optimize (15) 符合，api-gateway (80) 被过滤
    await expect(page.locator('[data-testid="asset-listing-card"]')).toHaveCount(2, {
      timeout: 5000,
    });
    await expect(page.getByText("context-scheduler")).toBeVisible();
    await expect(page.getByText("sql-optimize")).toBeVisible();
    await expect(page.getByText("api-gateway")).not.toBeVisible();
  });

  // TC4: 用户点击资产卡片
  test("TC4: 用户点击资产卡片 - URL 导航到 /browse/:assetId", async ({ page }) => {
    applyListingsMock(page);

    await page.goto(`${BASE}/marketplace`);
    await expect(page.locator('[data-testid="asset-listing-card"]')).toHaveCount(3, {
      timeout: 10000,
    });

    // 点击第一个资产卡片（context-scheduler, listing_id: l1）
    await page.getByText("context-scheduler").click();

    // 验证 URL 导航到 /browse/l1
    await expect(page).toHaveURL(/\/browse\/l1/, { timeout: 5000 });

    // 验证目标页面显示了资产详情
    await expect(page.getByRole("heading", { name: "context-scheduler" })).toBeVisible({
      timeout: 5000,
    });
  });

  // TC5: API 返回空列表
  test("TC5: API 返回空列表 - 显示 'No assets match your filters' 提示", async ({ page }) => {
    applyEmptyListingsMock(page);

    await page.goto(`${BASE}/marketplace`);

    // 等待页面加载
    await expect(page.getByRole("heading", { name: "Asset Marketplace" })).toBeVisible();

    // 等待请求完成
    await page.waitForResponse(
      (resp) => resp.url().includes("/api/v2/marketplace/listings"),
      { timeout: 10000 }
    );

    // 验证空状态提示
    await expect(page.getByText("No assets match your filters")).toBeVisible({
      timeout: 5000,
    });
  });

  // TC6: API 返回错误
  test("TC6: API 返回错误 - 显示错误提示", async ({ page }) => {
    applyErrorMock(page);

    await page.goto(`${BASE}/marketplace`);

    // 等待页面加载
    await expect(page.getByRole("heading", { name: "Asset Marketplace" })).toBeVisible();

    // 等待请求完成
    await page.waitForResponse(
      (resp) => resp.url().includes("/api/v2/marketplace/listings"),
      { timeout: 10000 }
    );

    // 验证错误提示显示（marketplace 页面使用 "Failed to load marketplace listings"）
    await expect(
      page.getByText(/Failed to load marketplace listings/i)
    ).toBeVisible({ timeout: 5000 });
  });
});
