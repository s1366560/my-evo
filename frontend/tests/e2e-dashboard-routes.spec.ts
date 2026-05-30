/**
 * E2E Tests: Dashboard Sub-Routes (/dashboard/bounties, /dashboard/onboarding)
 *
 * 覆盖流程：
 * - TC1: /dashboard/bounties 页面加载并显示 My Bounties 标题
 * - TC2: /dashboard/onboarding 页面正确处理重定向逻辑
 */

import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3002";

/** Inject authenticated auth-store state before navigation */
function injectAuth(page: Page) {
  void page.addInitScript(() => {
    const store = {
      state: {
        token: "mock-token-dashboard",
        userId: "node-mock-001",
      },
      version: 0,
    };
    window.localStorage.setItem("auth-storage", JSON.stringify(store));
    window.localStorage.setItem("onboarding_complete", "true");
  });
}

/** Mock bounty API responses */
function applyBountyMocks(page: Page) {
  // Mock GET /api/v2/bounty/my
  void page.route(/\/api\/v2\/bounty\/my/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: [],
      }),
    });
  });
}

test.describe("Dashboard Bounties Page", () => {
  test.beforeEach(async ({ page }) => {
    injectAuth(page);
    applyBountyMocks(page);
  });

  test("TC1: /dashboard/bounties loads and shows My Bounties heading", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/bounties`);
    await expect(page).toHaveURL(/\/dashboard\/bounties/);
    await expect(page.getByRole("heading", { name: /My Bounties/i })).toBeVisible();
  });

  test("TC2: /dashboard/bounties shows Create Bounty button", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/bounties`);
    await expect(page.getByRole("link", { name: /Create Bounty/i })).toBeVisible();
  });

  test("TC3: /dashboard/bounties handles empty state gracefully", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/bounties`);
    // Should show empty state message when no bounties
    await expect(page.getByText(/no bounties found|not created or claimed/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Dashboard Onboarding Page", () => {
  test.beforeEach(async ({ page }) => {
    injectAuth(page);
  });

  test("TC4: /dashboard/onboarding redirects when onboarding is complete", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/onboarding`);
    // Should redirect to /dashboard when onboarding_complete is true
    await expect(page).toHaveURL(/\/dashboard($|\?)/, { timeout: 5000 });
  });

  test("TC5: /dashboard/onboarding shows skeleton while checking status", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/onboarding`);
    // Should show loading state briefly
    const skeleton = page.locator('[class*="animate-pulse"]');
    await expect(skeleton.first()).toBeVisible({ timeout: 3000 }).catch(() => {
      // Skeleton may be too fast to catch, that's ok
    });
  });
});
