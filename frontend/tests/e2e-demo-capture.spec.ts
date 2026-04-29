/**
 * Demo 截图捕获测试
 * 专门用于捕获核心功能演示截图，包含登录、数据展示、地图交互等场景
 */

import { test, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const screenshotDir = path.join(__dirname, '../../docs/demo-screenshots');

// 确保截图目录存在
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

// Auth Helper
function injectAuth(page: Page) {
  page.addInitScript(() => {
    window.localStorage.setItem("evomap-auth", JSON.stringify({
      state: { token: "mock-token-123", userId: "user-test-001", isAuthenticated: true },
      version: 0,
    }));
  });
}

// Mock 数据
function mockApiRoutes(page: Page) {
  // Mock assets API
  page.route('**/a2a/assets*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          { asset_id: "asset_001", name: "Context Manager Pattern", type: "capsule", description: "Advanced context management", gdi: 85.5 },
          { asset_id: "asset_002", name: "Async Context Handler", type: "gene", description: "Async context utilities", gdi: 82.3 },
          { asset_id: "asset_003", name: "Data Context Store", type: "capsule", description: "State management with context", gdi: 80.1 },
        ],
        total: 3,
        page: 1,
        page_size: 20,
      }),
    });
  });

  // Mock dashboard stats API
  page.route('**/api/dashboard*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total_nodes: 150,
        live_nodes: 42,
        total_users: 1234,
        total_maps: 89,
      }),
    });
  });

  // Mock workspace tasks API
  page.route('**/api/tasks*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tasks: [
          { id: "task_001", title: "Research Task", status: "completed" },
          { id: "task_002", title: "Development Task", status: "in_progress" },
        ],
        total: 2,
      }),
    });
  });
}

test.describe('Demo 核心功能截图捕获', () => {

  /**
   * Demo 1: 登录/注册页面
   */
  test('Demo-01: 登录页面截图', async ({ page }) => {
    await page.goto('${BASE}/auth');
    await page.waitForLoadState('networkidle');
    
    // 截图保存
    await page.screenshot({
      path: path.join(screenshotDir, 'demo-01-login-page.png'),
      fullPage: false
    });
    
    console.log('Screenshot saved: demo-01-login-page.png');
  });

  /**
   * Demo 2: 首页/Dashboard
   */
  test('Demo-02: Dashboard 首页截图', async ({ page }) => {
    injectAuth(page);
    mockApiRoutes(page);
    
    await page.goto('${BASE}/');
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({
      path: path.join(screenshotDir, 'demo-02-dashboard-home.png'),
      fullPage: false
    });
    
    console.log('Screenshot saved: demo-02-dashboard-home.png');
  });

  /**
   * Demo 3: Browse 资产浏览页面
   */
  test('Demo-03: Browse 资产浏览页面截图', async ({ page }) => {
    injectAuth(page);
    mockApiRoutes(page);
    
    await page.goto('${BASE}/browse');
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({
      path: path.join(screenshotDir, 'demo-03-browse-page.png'),
      fullPage: false
    });
    
    console.log('Screenshot saved: demo-03-browse-page.png');
  });

  /**
   * Demo 4: Map Editor 地图编辑器
   */
  test('Demo-04: Map Editor 地图编辑器截图', async ({ page }) => {
    injectAuth(page);
    
    await page.goto('${BASE}/map/new');
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({
      path: path.join(screenshotDir, 'demo-04-map-editor.png'),
      fullPage: false
    });
    
    console.log('Screenshot saved: demo-04-map-editor.png');
  });

  /**
   * Demo 5: Workspace 工作区页面
   */
  test('Demo-05: Workspace 工作区截图', async ({ page }) => {
    injectAuth(page);
    mockApiRoutes(page);
    
    await page.goto('${BASE}/workspace');
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({
      path: path.join(screenshotDir, 'demo-05-workspace.png'),
      fullPage: false
    });
    
    console.log('Screenshot saved: demo-05-workspace.png');
  });

  /**
   * Demo 6: Data Visualization 数据可视化
   */
  test('Demo-06: Data Visualization 数据可视化截图', async ({ page }) => {
    injectAuth(page);
    mockApiRoutes(page);
    
    await page.goto('${BASE}/dataviz');
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({
      path: path.join(screenshotDir, 'demo-06-dataviz.png'),
      fullPage: false
    });
    
    console.log('Screenshot saved: demo-06-dataviz.png');
  });

  /**
   * Demo 7: Bounty 悬赏页面
   */
  test('Demo-07: Bounty 悬赏页面截图', async ({ page }) => {
    injectAuth(page);
    
    // Mock bounty API
    page.route('**/a2a/bounties*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            { bounty_id: "bounty_001", title: "Fix Login Bug", reward: 100, status: "open" },
            { bounty_id: "bounty_002", title: "Add Dark Mode", reward: 50, status: "open" },
          ],
          total: 2,
        }),
      });
    });
    
    await page.goto('${BASE}/bounty');
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({
      path: path.join(screenshotDir, 'demo-07-bounty.png'),
      fullPage: false
    });
    
    console.log('Screenshot saved: demo-07-bounty.png');
  });

  /**
   * Demo 8: 完整滚动页面截图 - Browse
   */
  test('Demo-08: Browse 完整页面截图', async ({ page }) => {
    injectAuth(page);
    mockApiRoutes(page);
    
    await page.goto('${BASE}/browse');
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({
      path: path.join(screenshotDir, 'demo-08-browse-fullpage.png'),
      fullPage: true
    });
    
    console.log('Screenshot saved: demo-08-browse-fullpage.png');
  });

  /**
   * Demo 9: Profile 用户设置页面
   */
  test('Demo-09: Profile 用户设置页面截图', async ({ page }) => {
    injectAuth(page);
    
    // Mock user API
    page.route('**/api/user*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          userId: "user-test-001",
          email: "test@example.com",
          username: "testuser",
          credits: 250,
        }),
      });
    });
    
    await page.goto('${BASE}/profile');
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({
      path: path.join(screenshotDir, 'demo-09-profile.png'),
      fullPage: false
    });
    
    console.log('Screenshot saved: demo-09-profile.png');
  });

  /**
   * Demo 10: Arena 对战竞技页面
   */
  test('Demo-10: Arena 对战竞技页面截图', async ({ page }) => {
    injectAuth(page);
    
    // Mock arena API
    page.route('**/api/arena*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          leaderboard: [
            { rank: 1, username: "Player1", score: 1500 },
            { rank: 2, username: "Player2", score: 1400 },
            { rank: 3, username: "Player3", score: 1300 },
          ],
        }),
      });
    });
    
    await page.goto('${BASE}/arena');
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({
      path: path.join(screenshotDir, 'demo-10-arena.png'),
      fullPage: false
    });
    
    console.log('Screenshot saved: demo-10-arena.png');
  });

});
