import { expect, test, type Page } from "@playwright/test";

const BASE = "http://localhost:3002";
const API = "http://localhost:3001";

/** Inject authenticated auth-store state before navigation (zustand persist → localStorage) */
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

/** Apply route mocks so UI-smoke tests work without a seeded database */
function applyMocks(page: Page) {
  // Network stats — used by HeroSection and Dashboard
  void page.route(`${API}/a2a/stats`, async (route) => {
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

  // Browse assets list — backend returns { success, data: { items: [...] } }
  // http-client unwraps to { items: [...] }, client.ts normalizes to Asset[]
  void page.route((url) => url.pathname === "/a2a/assets", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
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
        },
      }),
    });
  });

  // Asset keyword search — backend returns { success, data: [...] } (direct array)
  void page.route((url) => url.pathname === "/assets/search", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: [
          {
            asset_id: "sha256:security-scanner",
            name: "security-scanner",
            type: "Capsule",
            gdi_score: 72,
            signals: ["security", "static-analysis", "fast-scan"],
            created_at: "2025-02-01T08:00:00Z",
            downloads: 340,
          },
        ],
      }),
    });
  });

  // TrustBadge — requires authenticated userId to render "Verified"
  void page.route(`${API}/a2a/reputation/node-mock-001`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          node_id: "node-mock-001",
          score: 82,
          tier: "silver",
          trust: "verified",
        },
      }),
    });
  });
}

test.describe("UI Smoke Tests", () => {
  test("landing page loads hero section and stats grid", async ({ page }) => {
    applyMocks(page);
    await page.goto(BASE);

    // Hero headline updated to new messaging
    await expect(
      page.getByRole("heading", { level: 1 }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Scientific · evolving · trustworthy")).toBeVisible();

    // Stats grid section
    await expect(page.getByText("Ecosystem telemetry")).toBeVisible();
  });

  test("browse page renders search UI and asset results", async ({ page }) => {
    applyMocks(page);
    await page.goto(`${BASE}/browse`);

    await expect(
      page.getByRole("heading", { name: "Browse Assets" }),
    ).toBeVisible();
    await expect(page.getByRole("searchbox")).toBeVisible();
    // Mocked asset name from route interceptor (no search params → predicate matches)
    await expect(page.getByText("context-window-scheduler")).toBeVisible({ timeout: 8000 });

    // Search uses /assets/search endpoint — mock returns security-scanner
    await page.getByRole("searchbox").fill("security");
    await page.getByRole("searchbox").press("Enter");
    await expect(
      page.getByRole("heading", { name: /results for "security"/i }),
    ).toBeVisible();
    await expect(page.getByText("security-scanner")).toBeVisible({ timeout: 8000 });
  });

  test("dashboard page renders network overview cards", async ({ page }) => {
    injectAuth(page); // must come before applyMocks + goto so store is ready
    applyMocks(page);
    await page.goto(`${BASE}/dashboard`);

    await expect(
      page.getByRole("heading", { name: "Dashboard" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Network Overview")).toBeVisible();
    // Network stats come from mocked /a2a/stats — check for a formatted node count
    await expect(page.getByText("2,847")).toBeVisible({ timeout: 8000 });
    // TrustBadge renders "Verified" when auth store has userId
    await expect(page.getByText("Verified")).toBeVisible();
  });
});
