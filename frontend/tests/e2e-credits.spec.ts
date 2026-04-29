/**
 * E2E Tests: Credits Page (/dashboard/credits)
 *
 * 测试覆盖的流程：
 * - TC1: 认证用户访问 /dashboard/credits - 验证显示 "Credits" 标题和余额
 * - TC2: 显示交易历史表格 - mock /a2a/credits/:nodeId/history 返回3条交易，验证交易列表正确显示
 * - TC3: 无交易时显示空状态 - mock 返回 items:[]，验证显示 "No transactions yet"
 * - TC4: Credits 余额为 0 - mock 返回 balance:0，验证显示 0 余额
 * - TC5: 未认证用户访问 /dashboard/credits - 验证重定向到 /login
 *
 * Mock 数据说明：
 * - 使用 page.route() 拦截 API 请求
 * - Auth 状态通过 localStorage 注入 (evomap-auth)
 */

import { test, expect, type Page } from "@playwright/test";

// ── Shared constants ────────────────────────────────────────────────────────────

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3002";
const API = "http://127.0.0.1:8001";

// ── Shared mock data ───────────────────────────────────────────────────────────

const MOCK_NODE_ID = "node-test-001";
const MOCK_TOKEN = "mock-token-123";
const MOCK_USER_ID = "user-test-001";

const mockCreditsHistory = {
  items: [
    { id: "tx1", type: "publish_reward", amount: 50, balance_after: 125, created_at: "2025-04-01T10:00:00Z" },
    { id: "tx2", type: "asset_sale", amount: -20, balance_after: 75, created_at: "2025-03-15T08:00:00Z" },
  ],
  meta: { total: 125, page: 1, limit: 20 },
};

const mockCreditsHistoryThreeItems = {
  items: [
    { id: "tx1", type: "publish_reward", amount: 50, balance_after: 125, created_at: "2025-04-01T10:00:00Z" },
    { id: "tx2", type: "asset_sale", amount: -20, balance_after: 75, created_at: "2025-03-15T08:00:00Z" },
    { id: "tx3", type: "heartbeat_reward", amount: 5, balance_after: 130, created_at: "2025-04-05T12:00:00Z" },
  ],
  meta: { total: 130, page: 1, limit: 20 },
};

const mockCreditsZeroBalance = {
  items: [],
  meta: { total: 0, page: 1, limit: 20 },
};

// ── Auth helper ────────────────────────────────────────────────────────────────

/** 注入认证状态到 localStorage */
function injectAuth(page: Page) {
  void page.addInitScript(() => {
    window.localStorage.setItem(
      "evomap-auth",
      JSON.stringify({
        state: { token: MOCK_TOKEN, userId: MOCK_USER_ID, isAuthenticated: true },
        version: 0,
      })
    );
  });
}

// ── Clear auth state ──────────────────────────────────────────────────────────

/** 重置认证状态和 cookies */
async function clearAuthState(page: Page) {
  await page.goto(BASE);
  try {
    await page.evaluate(() => localStorage.removeItem("evomap-auth"));
  } catch {
    // localStorage not accessible on about:blank
  }
  await page.context().clearCookies();
  await page.reload();
}

// ── TC2: Mock helper for credits history (3 items) ─────────────────────────────

/** 为 credits history API 设置 mock 响应 */
function mockCreditsHistoryApi(page: Page, responseData: object) {
  void page.route(`${API}/a2a/credits/${MOCK_NODE_ID}/history`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: responseData }),
    });
  });
}

// ── Test Suite ─────────────────────────────────────────────────────────────────

test.describe("Credits Page E2E (/dashboard/credits)", () => {
  // --- TC1: 认证用户访问 Credits 页面，显示标题和余额 ---
  test("TC1: 认证用户访问 /dashboard/credits 显示 Credits 标题和余额", async ({ page }) => {
    injectAuth(page);
    mockCreditsHistoryApi(page, mockCreditsHistory);

    await page.goto(`${BASE}/dashboard/credits`);

    // 验证页面标题包含 Credits
    await expect(page.getByRole("heading", { name: /credits/i })).toBeVisible({ timeout: 10000 });

    // 验证余额显示 (balance_after 最后一条记录的值为 125)
    await expect(page.getByText(/125|balance/i)).toBeVisible();
  });

  // --- TC2: 显示交易历史表格，验证3条交易正确显示 ---
  test("TC2: 显示交易历史表格 - 验证交易列表正确显示3条记录", async ({ page }) => {
    injectAuth(page);
    mockCreditsHistoryApi(page, mockCreditsHistoryThreeItems);

    await page.goto(`${BASE}/dashboard/credits`);

    // 等待页面加载
    await page.waitForLoadState("networkidle");

    // 验证有交易记录显示 (检查表格行或交易列表项)
    const transactionItems = page.locator("[data-testid='transaction-item'], tbody tr, [data-testid='credits-row']");
    await expect(transactionItems.first()).toBeVisible({ timeout: 10000 });

    // 验证至少有 3 条交易记录
    const count = await transactionItems.count();
    expect(count).toBeGreaterThanOrEqual(3);

    // 验证交易类型显示 (publish_reward, asset_sale, heartbeat_reward)
    const pageContent = await page.content();
    expect(pageContent.toLowerCase()).toContain("publish_reward");
  });

  // --- TC3: 无交易时显示空状态 "No transactions yet" ---
  test("TC3: 无交易时显示空状态 - 验证显示 No transactions yet", async ({ page }) => {
    injectAuth(page);
    mockCreditsHistoryApi(page, { items: [], meta: { total: 0, page: 1, limit: 20 } });

    await page.goto(`${BASE}/dashboard/credits`);
    await page.waitForLoadState("networkidle");

    // 验证空状态提示
    await expect(page.getByText(/no transactions yet/i)).toBeVisible({ timeout: 10000 });
  });

  // --- TC4: Credits 余额为 0 时正确显示 ---
  test("TC4: Credits 余额为 0 - 验证显示 0 余额", async ({ page }) => {
    injectAuth(page);
    mockCreditsHistoryApi(page, mockCreditsZeroBalance);

    await page.goto(`${BASE}/dashboard/credits`);
    await page.waitForLoadState("networkidle");

    // 验证余额显示为 0 或相关提示
    await expect(page.getByText(/0|balance.*0/i)).toBeVisible({ timeout: 10000 });
  });

  // --- TC5: 未认证用户访问 /dashboard/credits 重定向到 /login ---
  test("TC5: 未认证用户访问 /dashboard/credits 重定向到 /login", async ({ page }) => {
    await clearAuthState(page);

    await page.goto(`${BASE}/dashboard/credits`);

    // 验证重定向到登录页
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    // 验证登录表单可见
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });
});
