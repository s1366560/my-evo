/**
 * E2E Tests: Browse & Search Pages
 * Covers: asset list, search, filters, empty states, trending
 */
import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3002";
const API = "http://localhost:3001";
const MOCK_TOKEN = "mock-token-browse";
const MOCK_USER_ID = "user-browse-001";

// Mock data matching handlers.ts for a2a/assets
const mockAssets = [
  { asset_id: "gene-001", name: "context-window-scheduler", type: "Gene", author_id: "node-alpha", author_name: "AlphaNode", gdi_score: 82, signals: ["context", "memory", "scheduling"], downloads: 1243, description: "Adaptive context window allocation based on task complexity", created_at: "2026-03-01T10:00:00Z" },
  { asset_id: "gene-002", name: "retrieval-augmented-gen", type: "Gene", author_id: "node-beta", author_name: "BetaNode", gdi_score: 91, signals: ["rag", "retrieval", "knowledge"], downloads: 3810, description: "RAG pipeline with hybrid dense/sparse retrieval", created_at: "2026-02-28T08:00:00Z" },
  { asset_id: "capsule-001", name: "code-review-agent", type: "Capsule", author_id: "node-gamma", author_name: "GammaNode", gdi_score: 78, signals: ["code", "review", "quality"], downloads: 567, description: "Automated code review agent with style enforcement", created_at: "2026-03-05T14:00:00Z" },
  { asset_id: "capsule-002", name: "security-scanner", type: "Capsule", author_id: "node-delta", author_name: "DeltaNode", gdi_score: 88, signals: ["security", "scan", "vulnerability"], downloads: 2109, description: "Static analysis scanner for OWASP Top 10 vulnerabilities", created_at: "2026-03-02T11:00:00Z" },
  { asset_id: "recipe-001", name: "fast-rag-pipeline", type: "Recipe", author_id: "node-alpha", author_name: "AlphaNode", gdi_score: { overall: 85, dimensions: { usefulness: 90, novelty: 78, rigor: 85, reuse: 87 } }, signals: ["rag", "fast", "pipeline"], downloads: 934, description: "Optimized RAG pipeline achieving sub-200ms latency", created_at: "2026-03-03T09:00:00Z" },
];

function injectAuth(page: Page) {
  void page.addInitScript(() => {
    window.localStorage.setItem("evomap-auth", JSON.stringify({ state: { token: MOCK_TOKEN, userId: MOCK_USER_ID, isAuthenticated: true }, version: 0 }));
  });
}

function applyAssetsMock(page: Page) {
  // Mock a2a/assets endpoint - returns { items: assets[] }
  void page.route(new RegExp(`${API}/a2a/assets`), (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: mockAssets }) })
  );
}

function applySearchMock(page: Page, results?: typeof mockAssets) {
  void page.route(new RegExp(`${API}/assets/search`), (r) => {
    const url = new URL(r.request().url());
    const q = url.searchParams.get("q") ?? "";
    const filtered = (results || mockAssets).filter((a) =>
      a.name.toLowerCase().includes(q.toLowerCase()) ||
      (a.description ?? "").toLowerCase().includes(q.toLowerCase())
    );
    return r.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ success: true, assets: filtered, total: filtered.length, data: filtered })
    });
  });
}

function applyTrendingMock(page: Page) {
  void page.route(new RegExp(`${API}/a2a/trending`), (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockAssets.slice(0, 3)) })
  );
}

test.describe("Browse & Search E2E", () => {
  test("TC1: Browse page loads and shows heading", async ({ page }) => {
    injectAuth(page);
    applyAssetsMock(page);
    await page.goto(`${BASE}/browse`);
    await page.waitForLoadState("domcontentloaded");
    // Check for page title
    await expect(page.getByRole("heading", { name: /browse assets/i })).toBeVisible({ timeout: 15000 });
  });

  test("TC2: Search input is functional", async ({ page }) => {
    injectAuth(page);
    applyAssetsMock(page);
    applySearchMock(page);
    await page.goto(`${BASE}/browse`);
    await page.waitForLoadState("domcontentloaded");
    // Check for search input
    const searchInput = page.getByRole("searchbox").first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill("context");
    await searchInput.press("Enter");
    // Should navigate to search results
    await expect(page).toHaveURL(/browse\?q=/);
  });

  test("TC3: Browse page has correct title structure", async ({ page }) => {
    injectAuth(page);
    applyAssetsMock(page);
    await page.goto(`${BASE}/browse`);
    await page.waitForLoadState("domcontentloaded");
    // Check page structure - should have h1 with "Browse"
    const h1 = page.locator("h1").first();
    await expect(h1).toContainText(/browse|assets/i, { ignoreCase: true });
  });
});
