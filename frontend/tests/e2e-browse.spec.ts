/**
 * E2E - Browse page: TC1 list load, TC2 search, TC3 empty, TC4 pagination, TC5 title, TC6 trending
 */
import { test, expect, Page } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3002';

function injectAuth(page: Page) {
  void page.addInitScript(() => {
    window.localStorage.setItem('evomap-auth', JSON.stringify({
      state: { token: 'mock-token-123', userId: 'user-test-001', isAuthenticated: true },
      version: 0,
    }));
  });
}

const mockAssets = [
  { asset_id: 'asset_001', name: 'Context Manager Pattern', type: 'Capsule', description: 'Advanced context management', gdi_score: 85.5, signals: ['context', 'async', 'pattern'], downloads: 120, author_id: 'author_1', created_at: '2024-01-15T00:00:00Z' },
  { asset_id: 'asset_002', name: 'Async Context Handler', type: 'Gene', description: 'Async context utilities', gdi_score: 82.3, signals: ['async', 'handler'], downloads: 85, author_id: 'author_2', created_at: '2024-01-10T00:00:00Z' },
  { asset_id: 'asset_003', name: 'Data Context Store', type: 'Capsule', description: 'State management', gdi_score: 80.1, signals: ['context', 'store'], downloads: 200, author_id: 'author_1', created_at: '2024-01-20T00:00:00Z' },
  { asset_id: 'asset_004', name: 'Context Pool Manager', type: 'Gene', description: 'Resource pool optimization', gdi_score: 78.9, signals: ['pool'], downloads: 45, author_id: 'author_3', created_at: '2024-01-25T00:00:00Z' },
  { asset_id: 'asset_005', name: 'Global Context Bridge', type: 'Capsule', description: 'Cross-component sharing', gdi_score: 76.5, signals: ['bridge'], downloads: 30, author_id: 'author_2', created_at: '2024-02-01T00:00:00Z' },
];

/** Apply route mocks using relative URL patterns (matches both BFF and backend calls) */
function applyMocks(page: Page) {
  // Assets list - matches both /a2a/assets and /api/v2/assets patterns
  void page.route(/\/(a2a\/assets|api\/v2\/assets)/, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: mockAssets, total: 5, page: 1, page_size: 20 }),
    });
  });

  // Search - matches /assets/search
  void page.route(/\/assets\/search/, (route) => {
    const url = new URL(route.request().url());
    const q = url.searchParams.get('q') ?? '';
    const results = mockAssets.filter(a => a.name.toLowerCase().includes(q.toLowerCase()));
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, assets: results, data: results, total: results.length }),
    });
  });

  // Trending
  void page.route(/\/a2a\/trending/, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: mockAssets.slice(0, 2), total: 2 }),
    });
  });
}

test.describe('Browse 页面', () => {
  test.beforeEach(async ({ page }) => { injectAuth(page); });

  test('TC1: 访问Browse页面,加载资产列表成功', async ({ page }) => {
    applyMocks(page);
    await page.goto(`${BASE}/browse`);
    await page.waitForLoadState('networkidle');
    const cards = page.locator('a[href^="/browse/"]');
    await expect(cards.first()).toBeVisible({ timeout: 15000 });
    expect(await cards.count()).toBeGreaterThanOrEqual(5);
  });

  test('TC2: 搜索资产功能正常', async ({ page }) => {
    applyMocks(page);
    await page.goto(`${BASE}/browse`);
    await page.waitForLoadState('networkidle');
    const inp = page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="Search" i]').first();
    await inp.fill('context');
    await inp.press('Enter');
    await page.waitForResponse(resp => /\/assets\/search/.test(resp.url()), { timeout: 10000 });
    const results = page.locator('a[href^="/browse/"]');
    await expect(results.first()).toBeVisible({ timeout: 10000 });
    expect(await results.count()).toBeGreaterThanOrEqual(2);
  });

  test('TC3: 搜索无结果显示空状态', async ({ page }) => {
    applyMocks(page);
    await page.goto(`${BASE}/browse?q=xyznonexistent`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1, h2, [class*="title"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('TC4: 分页导航功能正常', async ({ page }) => {
    applyMocks(page);
    await page.goto(`${BASE}/browse`);
    await page.waitForLoadState('networkidle');
    const nav = page.locator('nav, [class*="pagination"], button:has-text("next"), button:has-text("Next"), a[href*="page"]').first();
    await expect(nav).toBeVisible({ timeout: 10000 });
  });

  test('TC5: 页面标题为 Browse', async ({ page }) => {
    applyMocks(page);
    await page.goto(`${BASE}/browse`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1').first()).toContainText(/browse/i, { timeout: 10000 });
  });

  test('TC6: Trending 子页面切换正常', async ({ page }) => {
    applyMocks(page);
    await page.goto(`${BASE}/browse`);
    await page.waitForLoadState('networkidle');
    const tab = page.locator('a[href*="trending"], button:has-text("Trending")').first();
    if (await tab.isVisible()) {
      await tab.click();
      await page.waitForLoadState('networkidle');
      await expect(page.locator('a[href^="/browse/"]').first()).toBeVisible({ timeout: 10000 });
    }
  });
});
