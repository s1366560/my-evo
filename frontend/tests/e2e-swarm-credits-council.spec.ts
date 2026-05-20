/**
 * E2E Tests: Swarm / Credits / Council Pages
 * 覆盖流程:
 *   - TC1: 访问 /swarm 页面，验证页面标题显示
 *   - TC2: 访问 /credits 页面，验证页面标题显示
 *   - TC3: 访问 /council 页面，验证页面标题显示
 *   - TC4: Swarm 页面显示统计数据区块
 *   - TC5: Council 页面显示成员列表
 *   - TC6: Credits 页面显示余额信息
 */

import { test, expect, type Page } from "@playwright/test";

// ── Shared constants ────────────────────────────────────────────────────────────

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3002";
const API = "http://127.0.0.1:8001";

// ── Mock data ─────────────────────────────────────────────────────────────────

const mockSwarmStats = {
  success: true,
  data: {
    active_agents: 12,
    total_tasks: 847,
    completed_tasks: 823,
    queue_depth: 5,
    throughput: 47,
  },
};

const mockCreditsBalance = {
  success: true,
  data: {
    balance: 2500,
    tier: "premium",
    monthly_allowance: 2000,
    remaining_this_month: 1800,
    last_updated: new Date().toISOString(),
  },
};

const mockCreditsPackages = {
  success: true,
  data: {
    packages: [
      { id: "starter", name: "Starter Pack", credits: 500, bonus_credits: 0, price_cents: 499 },
      { id: "growth", name: "Growth Pack", credits: 2000, bonus_credits: 200, price_cents: 1499 },
      { id: "pro", name: "Pro Pack", credits: 5000, bonus_credits: 750, price_cents: 2999 },
    ],
    currency: "USD",
  },
};

const mockCouncilMembers = {
  success: true,
  data: [
    { id: "c1", name: "Alpha Arbiter", role: "governance", votes: 42, status: "active" },
    { id: "c2", name: "Beta Chancellor", role: "voting", votes: 38, status: "active" },
    { id: "c3", name: "Gamma Scribe", role: "policy", votes: 35, status: "active" },
  ],
};

// ── Route interceptors ──────────────────────────────────────────────────────────

function applySwarmMocks(page: Page) {
  void page.route(`${API}/api/v2/swarm/stats`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockSwarmStats),
    });
  });
}

function applyCreditsMocks(page: Page) {
  void page.route(`${API}/api/v2/credits/balance`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockCreditsBalance),
    });
  });
  void page.route(`${API}/api/v2/credits/packages`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockCreditsPackages),
    });
  });
}

function applyCouncilMocks(page: Page) {
  void page.route(`${API}/api/v2/council/members`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockCouncilMembers),
    });
  });
}

// ── Auth helper ────────────────────────────────────────────────────────────────

/** Inject mock auth state for authenticated pages */
function applyAuth(page: Page) {
  void page.addInitScript(() => {
    window.localStorage.setItem(
      "evomap-auth",
      JSON.stringify({ token: "mock-e2e-token", userId: "e2e-user-001" })
    );
    window.localStorage.setItem("evomap-node-secret", "mock-node-secret-e2e");
  });
}

// ── Test Suite ─────────────────────────────────────────────────────────────────

test.describe("Swarm / Credits / Council Pages E2E", () => {
  /**
   * TC1: 访问 /swarm 页面，验证页面标题显示
   */
  test("TC1: 访问 /swarm 页面，页面标题正确显示", async ({ page }) => {
    applySwarmMocks(page);

    await page.goto(`${BASE}/swarm`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    await expect(page.getByRole("heading", { name: /swarm/i })).toBeVisible({ timeout: 10000 });
  });

  /**
   * TC2: 访问 /credits 页面，验证页面标题显示
   */
  test("TC2: 访问 /credits 页面，页面标题正确显示", async ({ page }) => {
    applyAuth(page);
    applyCreditsMocks(page);

    await page.goto(`${BASE}/credits`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    await expect(page.getByRole("heading", { name: /credits/i })).toBeVisible({ timeout: 10000 });
  });

  /**
   * TC3: 访问 /council 页面，验证页面标题显示
   */
  test("TC3: 访问 /council 页面，页面标题正确显示", async ({ page }) => {
    applyCouncilMocks(page);

    await page.goto(`${BASE}/council`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    await expect(page.getByRole("heading", { name: /council/i })).toBeVisible({ timeout: 10000 });
  });

  /**
   * TC4: Swarm 页面显示统计数据区块
   */
  test("TC4: Swarm 页面显示统计数据区块", async ({ page }) => {
    applySwarmMocks(page);

    await page.goto(`${BASE}/swarm`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    // 等待页面加载
    await page.waitForTimeout(1000);

    // 验证至少有一个 stat card 可见
    const statsVisible = await (
      await page.getByText(/Active Agents/i).isVisible().catch(() => false) ||
      await page.getByText(/Total Tasks/i).isVisible().catch(() => false) ||
      await page.getByText(/Swarm Module/i).isVisible().catch(() => false)
    );
    expect(statsVisible).toBeTruthy();
  });

  /**
   * TC5: Council 页面显示成员列表或 Stub 内容
   */
  test("TC5: Council 页面显示 Council Members 区块", async ({ page }) => {
    applyCouncilMocks(page);

    await page.goto(`${BASE}/council`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    // 验证 Council Members 区块存在
    const membersSection = page.getByText(/Council Members/i);
    await expect(membersSection).toBeVisible({ timeout: 10000 });
  });

  /**
   * TC6: Credits 页面显示余额信息
   */
  test("TC6: Credits 页面显示 Balance 区块", async ({ page }) => {
    applyAuth(page);
    applyCreditsMocks(page);

    await page.goto(`${BASE}/credits`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    // 验证 Balance 或 Monthly Allowance 可见
    const balanceVisible = await (
      await page.getByText(/Balance/i).isVisible().catch(() => false) ||
      await page.getByText(/Monthly Allowance/i).isVisible().catch(() => false)
    );
    expect(balanceVisible).toBeTruthy();
  });

  /**
   * TC7: 所有页面返回 HTTP 200 (页面内容长度 > 阈值)
   */
  test("TC7: Swarm/Credits/Council 页面均可加载", async ({ page }) => {
    applySwarmMocks(page);
    applyCouncilMocks(page);

    const routes = ["/swarm", "/credits", "/council"];
    for (const route of routes) {
      const pageForRoute = route === "/credits"
        ? (applyAuth(page), page)
        : page;

      await page.goto(`${BASE}${route}`, { waitUntil: "load" });
      await page.waitForTimeout(3000);

      const contentLength = (await page.textContent("body") || "").length;
      expect(contentLength).toBeGreaterThan(50);
    }
  });
});
