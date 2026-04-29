import { expect, test, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3002";

/** Inject authenticated auth-store state before navigation */
function injectAuth(page: Page) {
  void page.addInitScript(() => {
    const store = {
      state: {
        token: "mock-token-123",
        userId: "node-mock-001",
      },
      version: 0,
    };
    window.localStorage.setItem("evomap-auth", JSON.stringify(store));
  });
}

/** Apply route mocks */
function applyMocks(page: Page) {
  void page.route(/\/a2a\/stats/, async (route) => {
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

  void page.route(/\/a2a\/assets/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            asset_id: "sha256:context-window-scheduler",
            name: "context-window-scheduler",
            type: "Capsule",
            gdi_score: 65,
            signals: ["context-aware", "llm-optimized", "low-latency"],
            created_at: "2025-01-15T10:00:00Z",
            downloads: 120,
          },
        ],
      }),
    });
  });

  void page.route(/\/assets\/search/, async (route) => {
    const url = route.request().url();
    const q = new URL(url).searchParams.get("q") ?? "";
    const isSecuritySearch = q.includes("security");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: isSecuritySearch
          ? [
              {
                asset_id: "sha256:security-scanner",
                name: "security-scanner",
                type: "Capsule",
                gdi_score: 72,
                signals: ["security", "static-analysis", "fast-scan"],
                created_at: "2025-02-01T08:00:00Z",
                downloads: 340,
              },
            ]
          : [
              {
                asset_id: "sha256:context-window-scheduler",
                name: "context-window-scheduler",
                type: "Capsule",
                gdi_score: 65,
                signals: ["context-aware", "llm-optimized", "low-latency"],
                created_at: "2025-01-15T10:00:00Z",
                downloads: 120,
              },
            ],
      }),
    });
  });

  void page.route(/\/a2a\/reputation\/node-mock-001/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { node_id: "node-mock-001", score: 73.3, tier: "Expert", trust: "verified" },
      }),
    });
  });

  void page.route(/\/api\/v1\/auth\/me/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { userId: "node-mock-001", email: "test@evomap.ai", role: "user" },
      }),
    });
  });

  void page.route(/\/a2a\/credits\/node-mock-001/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { node_id: "node-mock-001", balance: 42069, updated_at: "2026-04-29T00:00:00Z" },
      }),
    });
  });

  void page.route(/\/api\/v2\/dashboard/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "node-mock-001",
          username: "test-user",
          email: "test@evomap.ai",
          node_id: "node-mock-001",
          reputation: 73.3,
          trust_level: "verified",
          member_since: "2025-01-01",
        },
        credits: { balance: 42069, pending: 0, trend: "up", trend_percent: 12.5 },
        stats: {
          total_assets: 14832,
          total_calls: 89234,
          total_views: 234567,
          today_calls: 1234,
          total_bounties_earned: 3,
          active_bounties: 1,
          swarm_sessions: 5,
          completed_swarm_sessions: 4,
        },
        recent_assets: [],
        recent_activity: [],
        trending_signals: [],
      }),
    });
  });
}

test.describe("UI Smoke Tests", () => {
  test("landing page loads and contains EvoMap branding", async ({ page }) => {
    // Don't apply mocks for landing page - it should work without them
    await page.goto(BASE);
    
    // Wait for page content to load
    await page.waitForLoadState("domcontentloaded");
    
    // Check that the page contains EvoMap in the HTML
    const pageContent = await page.content();
    expect(pageContent).toContain("EvoMap");
    
    // Verify the title contains EvoMap
    const title = await page.title();
    expect(title).toContain("EvoMap");
  });

  test("browse page renders search UI and asset results", async ({ page }) => {
    applyMocks(page);
    await page.goto(`${BASE}/browse`);

    // Wait for hydration - BrowseContent uses useSearchParams() so Suspense boundary
    // must resolve before the heading appears
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("heading", { name: "Browse Assets" }),
    ).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("searchbox")).toBeVisible();
    // Wait for the mocked asset to appear
    await expect(page.getByText("context-window-scheduler")).toBeVisible({ timeout: 15000 });

    // Search test
    await page.getByRole("searchbox").fill("security");
    await page.getByRole("searchbox").press("Enter");
    await expect(
      page.getByRole("heading", { name: /results for "security"/i }),
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("security-scanner")).toBeVisible({ timeout: 15000 });
  });

  test("dashboard page renders network overview cards", async ({ page }) => {
    injectAuth(page);
    applyMocks(page);
    await page.goto(`${BASE}/dashboard`);

    await expect(
      page.getByRole("heading", { name: "Dashboard" }).first(),
    ).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[class*="dashboard"], [class*="grid"]').first()).toBeVisible({ timeout: 5000 });
  });
});
