/**
 * /dashboard 页面 E2E 测试
 * 覆盖流程：
 *   TC1: 认证用户访问 /dashboard，验证页面标题显示
 *   TC2: Stats cards 渲染（Total Assets, Total Calls, Total Views, Bounties Earned）
 *   TC3: Credits card 显示余额和趋势
 *   TC4: Quick Actions 按钮可点击
 *   TC5: Recent Assets 列表渲染或空状态
 *   TC6: Recent Activity feed 渲染或空状态
 *   TC7: 未认证用户访问 /dashboard，验证页面可访问
 */

import { test, expect, type Page } from "@playwright/test";

// ── Shared constants ────────────────────────────────────────────────────────────

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3002";
const API = "http://127.0.0.1:8001";

// ── Mock data ─────────────────────────────────────────────────────────────────

const mockDashboardStats = {
  total_assets: 24,
  total_calls: 1284,
  total_views: 8742,
  today_calls: 47,
  total_bounties_earned: 3,
  active_bounties: 1,
  swarm_sessions: 5,
  completed_swarm_sessions: 4,
};

const mockDashboardAssets = [
  { id: "1", name: "AlphaGene v2", type: "gene", gdi_score: 92.4, calls: 342, views: 1204, signals: ["code"], updated_at: new Date().toISOString() },
  { id: "2", name: "BetaCapsule", type: "capsule", gdi_score: 87.1, calls: 218, views: 876, signals: ["data"], updated_at: new Date().toISOString() },
];

const mockDashboardActivity = [
  { id: "a1", type: "publish", message: "Published AlphaGene v2", timestamp: new Date().toISOString() },
  { id: "a2", type: "call", message: "AlphaGene v2 called 12 times", timestamp: new Date(Date.now() - 3600000).toISOString() },
  { id: "a3", type: "view", message: "BetaCapsule viewed 5 times", timestamp: new Date(Date.now() - 7200000).toISOString() },
];

const mockDashboardCredits = {
  balance: 1250,
  pending: 150,
  trend: "up",
  trend_percent: 8,
};

// ── Route interceptors ──────────────────────────────────────────────────────────

function applyMocks(page: Page) {
  // Use wildcard patterns to catch all possible API base URL variants
  void page.route(/127\.0\.0\.1:8001|localhost:8001|localhost:3001/, async (route) => {
    const url = route.request().url();
    if (url.includes("/api/v2/dashboard/stats")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockDashboardStats) });
    } else if (url.includes("/api/v2/dashboard/assets")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockDashboardAssets) });
    } else if (url.includes("/api/v2/dashboard/activity")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockDashboardActivity) });
    } else if (url.includes("/api/v2/dashboard/credits")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockDashboardCredits) });
    } else {
      await route.continue();
    }
  });
}

// ── Auth helper ────────────────────────────────────────────────────────────────

function injectAuth(page: Page) {
  void page.addInitScript(() => {
    window.localStorage.setItem("evomap-auth", JSON.stringify({
      state: { token: "mock-token-123", userId: "user-test-001", isAuthenticated: true },
      version: 0,
    }));
  });
}

async function clearAuthState(page: Page) {
  await page.goto(BASE);
  await page.evaluate(() => window.localStorage.removeItem("evomap-auth"));
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe("Dashboard Page - Authenticated User", () => {

  test.beforeEach(async ({ page }) => {
    injectAuth(page);
    applyMocks(page);
  });

  test.afterEach(async ({ page }) => {
    await clearAuthState(page);
  });

  /**
   * TC1: 认证用户访问 /dashboard，验证显示 Dashboard 标题
   */
  test("TC1: 认证用户访问 /dashboard，验证显示 'Dashboard' 标题", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /^dashboard$/i })).toBeVisible();
  });

  /**
   * TC2: Stats cards 渲染
   */
  test("TC2: Stats cards 渲染（Total Assets, Total Calls, Total Views, Bounties Earned）", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Total Assets")).toBeVisible();
    await expect(page.getByText("Total Calls")).toBeVisible();
    await expect(page.getByText("Total Views")).toBeVisible();
    await expect(page.getByText("Bounties Earned")).toBeVisible();

    // 数值应显示
    await expect(page.getByText("24")).toBeVisible();
    await expect(page.getByText("1,284")).toBeVisible();
    await expect(page.getByText("8,742")).toBeVisible();
    await expect(page.getByText("3", { exact: true })).toBeVisible();
  });

  /**
   * TC3: Credits card 显示余额和趋势
   */
  test("TC3: Credits card 显示余额和趋势", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /credits/i })).toBeVisible();
    await expect(page.getByText("1,250")).toBeVisible();
    await expect(page.getByText("Available balance")).toBeVisible();
    await expect(page.getByText(/\+8%/)).toBeVisible();
  });

  /**
   * TC4: Quick Actions 按钮可点击
   */
  test("TC4: Quick Actions 按钮可点击", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /quick actions/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /publish new asset/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /create bounty/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /view ecosystem map/i })).toBeVisible();

    // 点击 Publish 导航
    await page.getByRole("button", { name: /publish new asset/i }).click();
    await expect(page).toHaveURL(/\/publish/);
  });

  /**
   * TC5: Recent Assets 列表渲染
   */
  test("TC5: Recent Assets 列表渲染", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /recent assets/i })).toBeVisible();
    await expect(page.getByText("AlphaGene v2", { exact: true })).toBeVisible();
    await expect(page.getByText("BetaCapsule", { exact: true })).toBeVisible();
    await expect(page.getByText("View All")).toBeVisible();
  });

  /**
   * TC6: Recent Activity feed 渲染
   */
  test("TC6: Recent Activity feed 渲染", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /recent activity/i })).toBeVisible();
    await expect(page.getByText("Published AlphaGene v2")).toBeVisible();
  });

});

test.describe("Dashboard Page - Unauthenticated User", () => {

  test.afterEach(async ({ page }) => {
    await clearAuthState(page);
  });

  /**
   * TC7: 未认证用户访问 /dashboard，验证页面可访问（显示 fallback 数据）
   */
  test("TC7: 未认证用户访问 /dashboard，页面可访问", async ({ page }) => {
    await clearAuthState(page);
    await page.goto(`${BASE}/dashboard`);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: /^dashboard$/i })).toBeVisible({ timeout: 10000 });
  });

});
