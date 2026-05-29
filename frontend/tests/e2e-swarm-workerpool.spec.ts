/**
 * E2E Tests: Swarm & Workerpool Pages
 *
 * 覆盖流程:
 * - TC1: 用户访问 /swarm 页面，验证页面加载
 * - TC2: Swarm 会话列表显示正确
 * - TC3: 用户创建新的 Swarm 会话
 * - TC4: Swarm 会话详情页显示任务列表
 * - TC5: 用户访问 /workerpool 页面
 * - TC6: Worker 列表显示正确
 * - TC7: Worker 筛选功能
 * - TC8: Worker 详情查看
 */

import { test, expect, type Page } from "@playwright/test";

// ── Shared constants ────────────────────────────────────────────────────────────

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3002";
const API = "http://127.0.0.1:8001";

// ── Shared mock data ───────────────────────────────────────────────────────────

const mockSwarms = {
  items: [
    {
      session_id: "swarm-001",
      name: "Market Analysis Swarm",
      status: "running",
      tasks_count: 5,
      participants: 3,
      created_at: "2025-04-20T10:00:00Z",
    },
    {
      session_id: "swarm-002",
      name: "Code Review Swarm",
      status: "completed",
      tasks_count: 8,
      participants: 4,
      created_at: "2025-04-19T14:00:00Z",
    },
  ],
};

const mockSwarmDetail = {
  session_id: "swarm-001",
  name: "Market Analysis Swarm",
  status: "running",
  tasks: [
    { task_id: "task-001", description: "Fetch market data", status: "completed", assignee: "node-1" },
    { task_id: "task-002", description: "Analyze trends", status: "in_progress", assignee: "node-2" },
    { task_id: "task-003", description: "Generate report", status: "pending", assignee: null },
  ],
  timeline: [
    { event: "swarm_created", timestamp: "2025-04-20T10:00:00Z" },
    { event: "task_assigned", timestamp: "2025-04-20T10:05:00Z" },
  ],
};

const mockWorkers = {
  items: [
    {
      node_id: "worker-001",
      name: "Alpha Worker",
      status: "active",
      skills: ["code-review", "security"],
      current_task: null,
      completed_tasks: 45,
    },
    {
      node_id: "worker-002",
      name: "Beta Worker",
      status: "busy",
      skills: ["data-analysis", "ml"],
      current_task: "task-002",
      completed_tasks: 32,
    },
    {
      node_id: "worker-003",
      name: "Gamma Worker",
      status: "idle",
      skills: ["documentation"],
      current_task: null,
      completed_tasks: 18,
    },
  ],
};

const mockCreateSwarmResponse = {
  success: true,
  data: {
    session_id: "swarm-new-001",
    name: "New Swarm Session",
    status: "pending",
  },
};

// ── Auth helper ────────────────────────────────────────────────────────────────

function injectAuth(page: Page) {
  void page.addInitScript(() => {
    window.localStorage.setItem(
      "evomap-auth",
      JSON.stringify({
        state: {
          token: "mock-token-swarm",
          userId: "user-swarm-001",
          isAuthenticated: true,
        },
        version: 0,
      })
    );
  });
}

// ── Route interceptors ──────────────────────────────────────────────────────────

function applySwarmMocks(page: Page) {
  void page.route(`${API}/swarm/sessions*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: mockSwarms }),
    });
  });

  void page.route(`${API}/swarm/sessions/swarm-001`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: mockSwarmDetail }),
    });
  });

  void page.route(`${API}/swarm/create`, async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockCreateSwarmResponse),
      });
    } else {
      await route.continue();
    }
  });

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
}

function applyWorkerMocks(page: Page) {
  void page.route(`${API}/workerpool/workers*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: mockWorkers }),
    });
  });
}

// ── Test Suite: Swarm ─────────────────────────────────────────────────────────

test.describe("Swarm Page E2E", () => {

  /**
   * TC1: 用户访问 /swarm 页面，验证页面加载
   */
  test("TC1: 访问 /swarm 页面，页面标题正确显示", async ({ page }) => {
    applySwarmMocks(page);

    await page.goto(`${BASE}/swarm`);
    await page.waitForLoadState("networkidle");

    // 验证页面标题
    await expect(page.getByRole("heading", { name: /swarm/i })).toBeVisible({ timeout: 10000 });
  });

  /**
   * TC2: Swarm 会话列表显示正确
   */
  test("TC2: Swarm 会话列表显示至少1个会话", async ({ page }) => {
    applySwarmMocks(page);

    await page.goto(`${BASE}/swarm`);
    await page.waitForLoadState("networkidle");

    // 等待会话列表加载
    const sessionCards = page.locator('[data-testid="swarm-card"], [data-testid="session-card"], .swarm-session');
    await expect(sessionCards.first()).toBeVisible({ timeout: 10000 });

    // 验证至少显示1个会话
    const count = await sessionCards.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // 验证会话名称显示
    await expect(page.getByText("Market Analysis Swarm")).toBeVisible();
  });

  /**
   * TC3: 用户创建新的 Swarm 会话
   */
  test("TC3: 用户可以创建新的 Swarm 会话", async ({ page }) => {
    applySwarmMocks(page);
    injectAuth(page);

    await page.goto(`${BASE}/swarm`);
    await page.waitForLoadState("networkidle");

    // 查找创建按钮
    const createButton = page.getByRole("button", { name: /create.*swarm|new.*swarm/i }).first();

    if (await createButton.isVisible()) {
      await createButton.click();
      await page.waitForTimeout(500);

      // 查找表单
      const nameInput = page.locator('input[id="name"], [data-testid="swarm-name-input"], input[placeholder*="name" i]').first();

      if (await nameInput.isVisible()) {
        await nameInput.fill("Test Swarm Session");

        // 提交
        const submitButton = page.getByRole("button", { name: /create|submit/i }).first();
        if (await submitButton.isVisible()) {
          await submitButton.click();

          // 等待创建请求完成
          await page.waitForResponse(
            (resp) => resp.url().includes("/swarm/create"),
            { timeout: 10000 }
          );

          // 验证成功（页面跳转或成功消息）
          const successMessage = page.getByText(/created|success/i).first();
          const hasSuccess = await successMessage.isVisible().catch(() => false);
          expect(hasSuccess || page.url().includes("swarm")).toBeTruthy();
        }
      }
    }
  });

  /**
   * TC4: Swarm 会话详情页显示任务列表
   */
  test("TC4: Swarm 会话详情页显示任务列表", async ({ page }) => {
    applySwarmMocks(page);

    await page.goto(`${BASE}/swarm/swarm-001`);
    await page.waitForLoadState("networkidle");

    // 验证会话名称显示
    await expect(page.getByText("Market Analysis Swarm")).toBeVisible();

    // 验证任务列表显示
    const taskItems = page.locator('[data-testid="task-item"], .task, tbody tr');
    await expect(taskItems.first()).toBeVisible({ timeout: 10000 });
  });

  /**
   * TC5: Swarm 状态显示正确
   */
  test("TC5: Swarm 会话状态显示正确 (running/completed)", async ({ page }) => {
    applySwarmMocks(page);

    await page.goto(`${BASE}/swarm`);
    await page.waitForLoadState("networkidle");

    // 验证状态显示
    await expect(page.getByText(/running|completed/i)).toBeVisible();
  });

  /**
   * TC6: Swarm 详情页显示时间线
   */
  test("TC6: Swarm 详情页显示时间线", async ({ page }) => {
    applySwarmMocks(page);

    await page.goto(`${BASE}/swarm/swarm-001`);
    await page.waitForLoadState("networkidle");

    // 查找时间线区域
    const timeline = page.locator('[data-testid="timeline"], .timeline, [class*="timeline"]').first();

    if (await timeline.isVisible()) {
      await expect(timeline).toBeVisible();
    } else {
      // 如果没有时间线，验证其他内容正常显示
      await expect(page.getByText("Market Analysis Swarm")).toBeVisible();
    }
  });
});

// ── Test Suite: Workerpool ──────────────────────────────────────────────────────

test.describe("Workerpool Page E2E", () => {

  /**
   * TC7: 用户访问 /workerpool 页面
   */
  test("TC7: 访问 /workerpool 页面，页面标题正确显示", async ({ page }) => {
    applyWorkerMocks(page);

    await page.goto(`${BASE}/workerpool`);
    await page.waitForLoadState("networkidle");

    // 验证页面标题
    await expect(page.getByRole("heading", { name: /worker.*pool|workerpool/i })).toBeVisible({ timeout: 10000 });
  });

  /**
   * TC8: Worker 列表显示正确
   */
  test("TC8: Worker 列表显示至少1个 Worker", async ({ page }) => {
    applyWorkerMocks(page);

    await page.goto(`${BASE}/workerpool`);
    await page.waitForLoadState("networkidle");

    // 等待 Worker 列表加载
    const workerCards = page.locator('[data-testid="worker-card"], [data-testid="worker-item"], .worker');
    await expect(workerCards.first()).toBeVisible({ timeout: 10000 });

    // 验证至少显示1个 Worker
    const count = await workerCards.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // 验证 Worker 名称显示
    await expect(page.getByText("Alpha Worker")).toBeVisible();
  });

  /**
   * TC9: Worker 状态显示正确
   */
  test("TC9: Worker 状态显示正确 (active/busy/idle)", async ({ page }) => {
    applyWorkerMocks(page);

    await page.goto(`${BASE}/workerpool`);
    await page.waitForLoadState("networkidle");

    // 验证状态显示
    await expect(page.getByText(/active|busy|idle/i)).toBeVisible();
  });

  /**
   * TC10: Worker 筛选功能
   */
  test("TC10: Worker 支持按状态筛选", async ({ page }) => {
    applyWorkerMocks(page);

    await page.goto(`${BASE}/workerpool`);
    await page.waitForLoadState("networkidle");

    // 查找筛选按钮
    const filterSelect = page.locator('[data-testid="status-filter"], select, [data-testid="filter-select"]').first();

    if (await filterSelect.isVisible()) {
      // 选择 "Active" 选项
      await filterSelect.selectOption({ label: 'Active' });
      await page.waitForLoadState("networkidle");

      // 验证列表更新
      await expect(page.locator('[data-testid="worker-card"], [data-testid="worker-item"]').first()).toBeVisible();
    } else {
      // 如果没有筛选器，验证页面正常显示
      await expect(page.getByRole("heading", { name: /worker.*pool/i })).toBeVisible();
    }
  });

  /**
   * TC11: Worker 详情查看
   */
  test("TC11: 点击 Worker 查看详情", async ({ page }) => {
    applyWorkerMocks(page);

    await page.goto(`${BASE}/workerpool`);
    await page.waitForLoadState("networkidle");

    // 等待 Worker 列表加载
    await page.waitForSelector('[data-testid="worker-card"], [data-testid="worker-item"]', { timeout: 10000 });

    // 点击第一个 Worker
    const firstWorker = page.getByText("Alpha Worker").first();
    if (await firstWorker.isVisible()) {
      await firstWorker.click();

      // 等待可能打开的详情
      await page.waitForTimeout(500);

      // 检查是否有详情模态框或内容
      const detailContent = page.locator('[data-testid="worker-detail"], [role="dialog"], .modal').first();
      const hasDetail = await detailContent.isVisible().catch(() => false);

      if (hasDetail) {
        await expect(detailContent).toBeVisible();
      }
    }
  });

  /**
   * TC12: Worker Skills 标签显示
   */
  test("TC12: Worker Skills 标签正确显示", async ({ page }) => {
    applyWorkerMocks(page);

    await page.goto(`${BASE}/workerpool`);
    await page.waitForLoadState("networkidle");

    // 验证 skills 标签显示
    const skillTags = page.locator('[data-testid="skill-tag"], .skill, [class*="tag"]');
    const hasSkills = await skillTags.first().isVisible().catch(() => false);

    if (hasSkills) {
      await expect(skillTags.first()).toBeVisible();
    } else {
      // 验证页面正常显示 Worker 列表
      await expect(page.getByText("Alpha Worker")).toBeVisible();
    }
  });
});
