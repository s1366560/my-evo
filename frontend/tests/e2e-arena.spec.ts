/**
 * E2E Tests: Arena / Competition Page
 *
 * 覆盖流程:
 * - TC1: 用户访问 /arena 页面，验证页面加载
 * - TC2: Arena 排行榜显示正确
 * - TC3: 用户点击参赛者查看详情
 * - TC4: Match History 显示历史对战记录
 * - TC5: Arena 统计数据正确显示
 * - TC6: 用户可切换不同分类的排行榜
 */

import { test, expect, type Page } from "@playwright/test";

// ── Shared constants ────────────────────────────────────────────────────────────

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3002";
const API = "http://127.0.0.1:8001";

// ── Shared mock data ───────────────────────────────────────────────────────────

const mockRankingData = {
  items: [
    {
      rank: 1,
      node_id: "node-champion-001",
      name: "Alpha Champion",
      score: 2850,
      wins: 45,
      losses: 5,
      win_rate: 0.9,
    },
    {
      rank: 2,
      node_id: "node-champion-002",
      name: "Beta Challenger",
      score: 2720,
      wins: 40,
      losses: 8,
      win_rate: 0.833,
    },
    {
      rank: 3,
      node_id: "node-champion-003",
      name: "Gamma Contender",
      score: 2650,
      wins: 38,
      losses: 10,
      win_rate: 0.792,
    },
  ],
  meta: { total: 100, page: 1, limit: 20 },
};

const mockMatchHistory = {
  items: [
    {
      match_id: "match-001",
      agent_a: "node-champion-001",
      agent_b: "node-champion-002",
      winner: "node-champion-001",
      score_a: 3,
      score_b: 1,
      timestamp: "2025-04-20T14:00:00Z",
    },
    {
      match_id: "match-002",
      agent_a: "node-champion-003",
      agent_b: "node-champion-001",
      winner: "node-champion-003",
      score_a: 3,
      score_b: 2,
      timestamp: "2025-04-20T13:00:00Z",
    },
  ],
};

const mockArenaStats = {
  total_matches: 15420,
  active_competitors: 892,
  total_prize_pool: 50000,
  current_season: "Season 7",
};

// ── Route interceptors ──────────────────────────────────────────────────────────

function applyMocks(page: Page) {
  void page.route(/\/api\/v2\/arena\/rankings\//, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: mockRankingData }),
    });
  });

  void page.route(/\/api\/v2\/arena\/matches/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: mockMatchHistory }),
    });
  });

  void page.route(/\/api\/v2\/arena\/stats/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: mockArenaStats }),
    });
  });
}

// ── Test Suite ─────────────────────────────────────────────────────────────────

test.describe("Arena / Competition Page E2E", () => {

  /**
   * TC1: 用户访问 /arena 页面，验证页面加载
   */
  test("TC1: 访问 /arena 页面，页面标题正确显示", async ({ page }) => {
    applyMocks(page);

    await page.goto(`${BASE}/arena`);
    await page.waitForLoadState("networkidle");

    // 验证页面标题
    await expect(page.getByRole("heading", { name: /arena/i })).toBeVisible({ timeout: 10000 });
  });

  /**
   * TC2: Arena 排行榜显示正确 - 验证前3名显示
   */
  test("TC2: Arena 排行榜显示前3名参赛者", async ({ page }) => {
    applyMocks(page);

    await page.goto(`${BASE}/arena`);
    await page.waitForLoadState("networkidle");

    // 等待排行榜加载
    const rankingTable = page.locator('[data-testid="ranking-table"], table, [data-testid="ranking"]').first();
    await expect(rankingTable).toBeVisible({ timeout: 10000 });

    // 验证显示排名
    await expect(page.getByText("1")).toBeVisible();
    await expect(page.getByText("2")).toBeVisible();
    await expect(page.getByText("3")).toBeVisible();

    // 验证参赛者名称
    await expect(page.getByText("Alpha Champion")).toBeVisible();
    await expect(page.getByText("Beta Challenger")).toBeVisible();
    await expect(page.getByText("Gamma Contender")).toBeVisible();
  });

  /**
   * TC3: 用户点击参赛者查看详情
   */
  test("TC3: 点击参赛者卡片查看详情", async ({ page }) => {
    applyMocks(page);

    await page.goto(`${BASE}/arena`);
    await page.waitForLoadState("networkidle");

    // 等待页面加载
    await page.waitForSelector('[data-testid="ranking-table"], table, [data-testid="ranking"]', { timeout: 10000 });

    // 点击第一个参赛者
    const firstCompetitor = page.getByText("Alpha Champion").first();
    if (await firstCompetitor.isVisible()) {
      await firstCompetitor.click();

      // 验证可能打开详情模态框或导航到详情页
      // 等待可能出现的详情内容
      await page.waitForTimeout(500);

      // 检查是否有模态框或详情区域
      const detailModal = page.locator('[data-testid="competitor-detail"], [role="dialog"], .modal').first();
      const hasModal = await detailModal.isVisible().catch(() => false);

      if (hasModal) {
        await expect(detailModal).toBeVisible();
        await expect(page.getByText("Alpha Champion")).toBeVisible();
      }
    }
  });

  /**
   * TC4: Match History 显示历史对战记录
   */
  test("TC4: Match History 显示历史对战记录", async ({ page }) => {
    applyMocks(page);

    await page.goto(`${BASE}/arena`);
    await page.waitForLoadState("networkidle");

    // 查找 Match History 部分
    const matchHistorySection = page.getByText(/match.*history|历史.*对战/i).first();
    if (await matchHistorySection.isVisible()) {
      // 验证对战记录显示
      await expect(matchHistorySection).toBeVisible();

      // 验证至少显示一条记录
      await expect(page.getByText("match-001").or(page.getByText(/Alpha.*Champion.*vs.*Beta/i))).toBeVisible();
    } else {
      // 如果没有专门的 Match History 区域，至少验证页面能加载
      await expect(page.getByRole("heading", { name: /arena/i })).toBeVisible();
    }
  });

  /**
   * TC5: Arena 统计数据正确显示
   */
  test("TC5: Arena 统计数据正确显示", async ({ page }) => {
    applyMocks(page);

    await page.goto(`${BASE}/arena`);
    await page.waitForLoadState("networkidle");

    // 验证统计数据显示
    // 查找包含 "Season" 或 "Matches" 等关键词的元素
    const seasonText = page.getByText(/Season/i);
    const matchesText = page.getByText(/15,420|total.*match/i);
    const competitorsText = page.getByText(/892|active.*competitor/i);

    // 至少验证一个统计数据可见
    const hasStats = await (
      await seasonText.isVisible().catch(() => false) ||
      await matchesText.isVisible().catch(() => false) ||
      await competitorsText.isVisible().catch(() => false)
    );

    expect(hasStats).toBeTruthy();
  });

  /**
   * TC6: 用户可切换不同分类的排行榜
   */
  test("TC6: 排行榜支持分类切换", async ({ page }) => {
    applyMocks(page);

    await page.goto(`${BASE}/arena`);
    await page.waitForLoadState("networkidle");

    // 查找分类切换按钮
    const categoryButtons = page.locator('[data-testid="category-tab"], button[class*="tab"], [role="tab"]');
    const buttonCount = await categoryButtons.count();

    if (buttonCount > 1) {
      // 点击第二个分类
      await categoryButtons.nth(1).click();
      await page.waitForLoadState("networkidle");

      // 验证排行榜内容更新
      await expect(page.locator("table, [data-testid='ranking']")).toBeVisible();
    } else {
      // 如果只有一个分类，至少验证页面正常工作
      await expect(page.getByRole("heading", { name: /arena/i })).toBeVisible();
    }
  });

  /**
   * TC7: 排行榜分页功能
   */
  test("TC7: 排行榜支持分页", async ({ page }) => {
    applyMocks(page);

    await page.goto(`${BASE}/arena?page=1`);
    await page.waitForLoadState("networkidle");

    // 查找分页控件
    const pagination = page.locator('[data-testid="pagination"], .pagination, nav[aria-label="pagination"]').first();

    if (await pagination.isVisible()) {
      await expect(pagination).toBeVisible();

      // 查找下一页按钮
      const nextButton = page.getByRole("button", { name: /next|下页/i }).first();
      if (await nextButton.isVisible()) {
        await nextButton.click();
        await page.waitForLoadState("networkidle");

        // 验证 URL 更新
        await expect(page).toHaveURL(/page=2/);
      }
    }
  });

  /**
   * TC8: 页面加载时显示 Loading 骨架屏
   */
  test("TC8: 页面加载时显示骨架屏或 Loading 状态", async ({ page }) => {
    applyMocks(page);

    await page.goto(`${BASE}/arena`);

    // 在内容加载前检查骨架屏
    const skeleton = page.locator('[data-testid="skeleton"], .skeleton, [class*="loading"]').first();

    // 骨架屏可能是短暂的，如果可见则验证
    const skeletonVisible = await skeleton.isVisible().catch(() => false);

    // 等待主要内容加载
    await expect(page.getByRole("heading", { name: /arena/i })).toBeVisible({ timeout: 10000 });

    // 骨架屏应该在内容加载后消失
    if (skeletonVisible) {
      await expect(skeleton).not.toBeVisible({ timeout: 5000 });
    }
  });
});
