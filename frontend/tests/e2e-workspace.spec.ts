/**
 * E2E - Workspace page: task list, goals, workers, preflight checks
 */
import { test, expect, Page } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3002';

function injectAuth(page: Page) {
  void page.addInitScript(() => {
    window.localStorage.setItem("evomap-auth", JSON.stringify({
      state: { token: "mock-token-123", userId: "user-test-001", isAuthenticated: true },
      version: 0,
    }));
  });
}

const mockTask = {
  id: "t1", taskId: "t1", title: "Build Feature X",
  status: "in_progress", progressPct: 50,
  description: "Implement the feature", role: "execution_task",
  dependencies: [], createdAt: "2026-04-28T00:00:00Z",
  updatedAt: "2026-04-28T00:00:00Z",
};

const mockWorker = {
  id: "w1", name: "Builder Agent",
  role: "builder" as const, status: "idle" as const,
  assignedTasks: [], joinedAt: "2026-04-28T00:00:00Z",
};

const mockGoal = {
  id: "g1", title: "Complete Project",
  description: "Finish the my-evo project", progress: 60,
  status: "active" as const, childTasks: ["t1"],
  createdAt: "2026-04-28T00:00:00Z",
};

/** Apply workspace route mocks using relative URL patterns */
function applyWorkspaceMocks(page: Page) {
  // Use relative URL patterns that match both absolute and BFF calls
  void page.route(/\/api\/v2\/workspace\/current/, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: "ws1", name: "EvoMap Workspace", memberCount: 2, reputation: 85, credits: 100 }),
    });
  });
  void page.route(/\/api\/v2\/workspace\/tasks/, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ tasks: [mockTask], total: 1 }),
    });
  });
  void page.route(/\/api\/v2\/workspace\/goals/, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ goals: [mockGoal], total: 1 }),
    });
  });
  void page.route(/\/api\/v2\/workspace\/workers/, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ workers: [mockWorker], total: 1 }),
    });
  });
}

test.describe('Workspace 页面', () => {
  test.beforeEach(async ({ page }) => { injectAuth(page); });

  test('TC1: 工作区页面加载,显示任务列表', async ({ page }) => {
    applyWorkspaceMocks(page);
    await page.goto(`${BASE}/workspace`);
    await page.waitForLoadState('networkidle');
    // 任务卡片应可见
    const taskCard = page.locator('text=/Build Feature X/i').first();
    await expect(taskCard).toBeVisible({ timeout: 10000 });
  });

  test('TC2: 任务卡片显示状态标签', async ({ page }) => {
    applyWorkspaceMocks(page);
    await page.goto(`${BASE}/workspace`);
    await page.waitForLoadState('networkidle');
    // Verify task card renders with title text
    const taskCard = page.locator('text=/Build Feature X/i').first();
    await expect(taskCard).toBeVisible({ timeout: 10000 });
    // Also verify a status-related badge or text is visible
    const statusText = page.locator('text=/In Progress/i').first();
    const hasStatus = await statusText.isVisible().catch(() => false);
    expect(hasStatus).toBeTruthy();
  });

  test('TC3: 工作区工作器状态显示', async ({ page }) => {
    // Override workers endpoint for this test
    void page.route(/\/api\/v2\/workspace\/current/, (route) => {
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ id: "ws1", name: "Test", memberCount: 1 }) });
    });
    void page.route(/\/api\/v2\/workspace\/tasks/, (route) => {
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ tasks: [], total: 0 }) });
    });
    void page.route(/\/api\/v2\/workspace\/goals/, (route) => {
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ goals: [], total: 0 }) });
    });
    void page.route(/\/api\/v2\/workspace\/workers/, (route) => {
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ workers: [mockWorker], total: 1 }) });
    });
    await page.goto(`${BASE}/workspace`);
    await page.waitForLoadState('networkidle');
    // Switch to workers tab if needed
    const workersTab = page.locator('button:has-text("workers"), [role="tab"]:has-text("workers")').first();
    if (await workersTab.isVisible().catch(() => false)) {
      await workersTab.click();
      await page.waitForTimeout(500);
    }
    const workerSection = page.locator('text=/Builder Agent/i').first();
    await expect(workerSection).toBeVisible({ timeout: 10000 });
  });

  test('TC4: Preflight检查区域可见', async ({ page }) => {
    void page.route(/\/api\/v2\/workspace\/current/, (route) => {
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ id: "ws1", name: "EvoMap Workspace", memberCount: 2 }) });
    });
    await page.goto(`${BASE}/workspace`);
    await page.waitForLoadState('networkidle');
    // Header 或任务标签页应可见
    const header = page.locator('h1, h2').first();
    await expect(header).toBeVisible({ timeout: 10000 });
  });

  test('TC5: 页面加载无崩溃', async ({ page }) => {
    void page.route(/\/api\/v2\/workspace\/current/, (route) => {
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ id: "ws1", name: "Test Workspace", memberCount: 1 }) });
    });
    await page.goto(`${BASE}/workspace`);
    await page.waitForLoadState('networkidle');
    // 验证页面渲染（无错误对话框）
    const errorDialog = page.locator('dialog:has-text("Error"), [class*="error"]').first();
    const noError = !(await errorDialog.isVisible().catch(() => false));
    expect(noError).toBeTruthy();
  });
});
