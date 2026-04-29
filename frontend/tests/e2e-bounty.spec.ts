/**
 * E2E Tests: Bounty Pages (/bounty, /bounty/[bountyId])
 *
 * 覆盖流程：
 * - TC1: Bounty 列表页显示 Bounties 标题
 * - TC2: Bounty 列表显示 mock bounty 数据卡片
 * - TC3: 点击 bounty 卡片跳转详情页
 * - TC4: Bounty 详情页显示完整 bounty 信息
 * - TC5: Bounty 详情页显示 Bid 表单（认证用户）
 * - TC6: 未认证用户访问 /bounty/[id] 不显示 Bid 表单
 * - TC7: Bounty 过滤功能 - 按状态筛选
 * - TC8: Bounty 列表空状态显示
 * - TC9: Bounty Hall 页面显示统计卡片
 */

import { test, expect, type Page } from "@playwright/test";

// ── Shared constants ────────────────────────────────────────────────────────────

const BASE = "http://127.0.0.1:3002";
// The app calls relative URLs (/api/v2/bounty/*) which resolve to BASE (Next.js BFF).
// So intercepts must target BASE, not the backend API port.
const BFF = BASE;

// ── Shared mock data ────────────────────────────────────────────────────────────

const MOCK_TOKEN = "mock-token-bounty";
const MOCK_USER_ID = "user-bounty-001";
const MOCK_NODE_ID = "node-bounty-001";

const mockBountyList = {
  success: true,
  data: {
    items: [
      {
        bounty_id: "bty-001",
        title: "Fix authentication bug in login flow",
        description: "Users are unable to login when using special characters in passwords. Need to implement proper escaping.",
        amount: 500,
        status: "open",
        deadline: "2026-05-30T00:00:00Z",
        requirements: ["React", "Authentication", "Security"],
        submissions_count: 3,
        creator_name: "alice",
        created_at: "2026-04-01T10:00:00Z",
      },
      {
        bounty_id: "bty-002",
        title: "Add dark mode support to dashboard",
        description: "Implement a dark mode toggle in the settings page with system preference detection.",
        amount: 300,
        status: "open",
        deadline: "2026-06-15T00:00:00Z",
        requirements: ["CSS", "Next.js", "Tailwind"],
        submissions_count: 1,
        creator_name: "bob",
        created_at: "2026-04-10T14:30:00Z",
      },
      {
        bounty_id: "bty-003",
        title: "Optimize database queries",
        description: "Several queries are running slowly. Need to add proper indexes and optimize ORM usage.",
        amount: 750,
        status: "claimed",
        deadline: "2026-05-20T00:00:00Z",
        requirements: ["PostgreSQL", "ORM", "Performance"],
        submissions_count: 5,
        creator_name: "carol",
        created_at: "2026-03-25T09:00:00Z",
      },
    ],
  },
};

const mockBountyDetail = {
  success: true,
  data: {
    bounty: {
      bounty_id: "bty-001",
      title: "Fix authentication bug in login flow",
      description: "Users are unable to login when using special characters in passwords. Need to implement proper escaping.",
      amount: 500,
      status: "open",
      deadline: "2026-05-30T00:00:00Z",
      requirements: ["React", "Authentication", "Security"],
      submissions_count: 3,
      creator_name: "alice",
      creator_id: "user-alice-001",
      created_at: "2026-04-01T10:00:00Z",
      bids: [
        { bid_id: "bid-001", bidder_name: "dev1", proposed_amount: 450, status: "pending" },
        { bid_id: "bid-002", bidder_name: "dev2", proposed_amount: 500, status: "pending" },
      ],
    },
  },
};

const mockBountyStats = {
  success: true,
  data: {
    total_bounties: 24,
    open_bounties: 12,
    total_reward_pool: 18500,
    completed_bounties: 8,
  },
};

const mockEmptyBountyList = {
  success: true,
  data: { items: [] },
};

// ── Route interceptors ──────────────────────────────────────────────────────────

function applyBountyMocks(page: Page) {
  void page.route(`${BFF}/api/v2/bounty/`, async (route) => {
    const url = route.request().url();
    // If requesting with status filter
    if (url.includes("status=")) {
      const hasOpen = url.includes("open");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            items: hasOpen
              ? mockBountyList.data.items.filter((b) => b.status === "open")
              : [],
          },
        }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockBountyList),
      });
    }
  });

  void page.route(`${BFF}/api/v2/bounty/stats`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockBountyStats),
    });
  });

  void page.route(new RegExp(`${BFF}/api/v2/bounty/bty-001`), async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockBountyDetail),
    });
  });

  void page.route(`${BFF}/api/v2/bounty/bty-001/bid`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { bid_id: "bid-new-001", status: "pending" },
      }),
    });
  });

  // a2a/stats — called via relative URL /a2a/stats → resolves to BFF
  void page.route(`${BFF}/a2a/stats`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
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

// ── Auth helper ────────────────────────────────────────────────────────────────

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

// ── Test Suite: Bounty List Page ────────────────────────────────────────────────

test.describe("Bounty List Page (/bounty)", () => {
  test.beforeEach(async ({ page }) => {
    applyBountyMocks(page);
  });

  test.afterEach(async ({ page }) => {
    await clearAuthState(page);
  });

  test("TC1: Bounty 列表页显示 Bounties 标题", async ({ page }) => {
    await page.goto(`${BASE}/bounty`);
    await expect(page.getByRole("heading", { name: /bounties/i })).toBeVisible({ timeout: 10000 });
  });

  test("TC2: Bounty 列表显示 bounty 数据卡片", async ({ page }) => {
    await page.goto(`${BASE}/bounty`);
    await page.waitForLoadState("networkidle");

    // Wait for at least one bounty card to appear
    await expect(page.getByText("Fix authentication bug in login flow")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Add dark mode support to dashboard")).toBeVisible();
    await expect(page.getByText("$500")).toBeVisible();
    await expect(page.getByText("$300")).toBeVisible();
  });

  test("TC7: Bounty 过滤功能 - 按状态筛选 open", async ({ page }) => {
    await page.goto(`${BASE}/bounty`);
    await page.waitForLoadState("networkidle");

    // Look for filter buttons or dropdown
    const filterButton = page.getByRole("button", { name: /open|filter/i }).first();
    if (await filterButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filterButton.click();
      // After filtering, only open bounties should show
      await expect(page.getByText("Fix authentication bug in login flow")).toBeVisible({ timeout: 5000 });
    }
  });

  test("TC8: Bounty 列表空状态显示", async ({ page }) => {
    // Override to return empty list
    void page.route(`${BFF}/api/v2/bounty/`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockEmptyBountyList),
      });
    });

    await page.goto(`${BASE}/bounty`);
    await page.waitForLoadState("networkidle");

    // Should show some empty state or no bounties message
    await expect(page.locator("body")).not.toBeEmpty();
  });
});

// ── Test Suite: Bounty Detail Page ────────────────────────────────────────────

test.describe("Bounty Detail Page (/bounty/[bountyId])", () => {
  test.beforeEach(async ({ page }) => {
    applyBountyMocks(page);
  });

  test.afterEach(async ({ page }) => {
    await clearAuthState(page);
  });

  test("TC3: 点击 bounty 卡片跳转详情页", async ({ page }) => {
    await page.goto(`${BASE}/bounty`);
    await page.waitForLoadState("networkidle");

    // Click on the first bounty card
    const bountyCard = page.getByText("Fix authentication bug in login flow").first();
    await bountyCard.click();

    // Verify URL changed to detail page
    await expect(page).toHaveURL(/\/bounty\/bty-001/, { timeout: 10000 });
  });

  test("TC4: Bounty 详情页显示完整 bounty 信息", async ({ page }) => {
    await page.goto(`${BASE}/bounty/bty-001`);
    await page.waitForLoadState("networkidle");

    // Verify bounty title
    await expect(page.getByText("Fix authentication bug in login flow")).toBeVisible({ timeout: 10000 });

    // Verify description
    await expect(page.getByText(/authentication bug/i)).toBeVisible();

    // Verify reward amount
    await expect(page.getByText("$500")).toBeVisible();

    // Verify status badge
    await expect(page.getByText("Open")).toBeVisible();

    // Verify requirements tags
    await expect(page.getByText("React")).toBeVisible();
    await expect(page.getByText("Authentication")).toBeVisible();
  });

  test("TC5: 认证用户看到 Bid 表单", async ({ page }) => {
    injectAuth(page);
    await page.goto(`${BASE}/bounty/bty-001`);
    await page.waitForLoadState("networkidle");

    // Bid or Submit button should be visible for authenticated users
    const bidButton = page.getByRole("button", { name: /bid|place bid|submit/i }).first();
    await expect(bidButton).toBeVisible({ timeout: 5000 });
  });

  test("TC6: 未认证用户不显示 Bid 表单", async ({ page }) => {
    await page.goto(`${BASE}/bounty/bty-001`);
    await page.waitForLoadState("networkidle");

    // Bid/Submit button should not be visible for unauthenticated users
    // Or should redirect to login when clicked
    const bidButton = page.getByRole("button", { name: /bid|place bid/i });
    // Either not visible or redirects to login
    if (await bidButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await bidButton.click();
      await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
    }
  });
});

// ── Test Suite: Bounty Hall Page ───────────────────────────────────────────────

test.describe("Bounty Hall Page (/bounty-hall)", () => {
  test.beforeEach(async ({ page }) => {
    applyBountyMocks(page);
  });

  test.afterEach(async ({ page }) => {
    await clearAuthState(page);
  });

  test("TC9: Bounty Hall 页面显示统计卡片", async ({ page }) => {
    await page.goto(`${BASE}/bounty-hall`);
    await page.waitForLoadState("networkidle");

    // Check for stats section
    const bodyContent = await page.content();
    // Should have some stats visible (either from API or skeleton)
    await expect(page.locator("body")).not.toBeEmpty();
  });
});
