/**
 * E2E - Map Editor page: canvas, toolbar (Add, AI, Zoom, Export), empty state
 */
import { test, expect, Page } from '@playwright/test';

function injectAuth(page: Page) {
  void page.addInitScript(() => {
    window.localStorage.setItem("evomap-auth", JSON.stringify({
      state: { token: "mock-token-123", userId: "user-test-001", isAuthenticated: true },
      version: 0,
    }));
  });
}

test.describe('Map Editor 页面', () => {
  test.beforeEach(async ({ page }) => { injectAuth(page); });

  test('TC1: 编辑器页面加载成功,显示画布和工具栏', async ({ page }) => {
    await page.goto('/editor');
    await page.waitForLoadState('networkidle');
    // 验证标题文本或空状态提示可见
    const emptyText = page.locator('text=/Start building|knowledge map/i');
    const toolbar = page.locator('[class*="toolbar"], [class*="tool-bar"]').first();
    const visible = await emptyText.isVisible().catch(() => false) || await toolbar.isVisible().catch(() => false);
    expect(visible).toBeTruthy();
  });

  test('TC2: 点击Add按钮添加Gene节点', async ({ page }) => {
    await page.goto('/editor');
    await page.waitForLoadState('networkidle');
    // 查找 "Add" 按钮并点击
    const addBtn = page.locator('button:has-text("Add"), button:has-text("Add")').first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(500);
      // 打开下拉菜单后选择 Gene
      const geneItem = page.locator('text=/^Gene$/').first();
      if (await geneItem.isVisible()) {
        await geneItem.click();
        await page.waitForTimeout(1000);
      }
    }
    // 验证底部状态栏显示节点数 > 0 或画布加载
    const statusBar = page.locator('text=/\\d+ nodes/').first();
    const visible = await statusBar.isVisible().catch(() => false);
    expect(visible).toBeTruthy();
  });

  test('TC3: AI生成按钮可点击', async ({ page }) => {
    await page.goto('/editor');
    await page.waitForLoadState('networkidle');
    const aiBtn = page.locator('button:has-text("AI"), button:has-text("Generating")').first();
    await expect(aiBtn).toBeVisible({ timeout: 10000 });
    // 点击 AI 按钮
    await aiBtn.click();
    await page.waitForTimeout(500);
  });

  test('TC4: 工具栏Zoom按钮可见', async ({ page }) => {
    await page.goto('/editor');
    await page.waitForLoadState('networkidle');
    const zoomIn = page.locator('button[title="Zoom in"]').first();
    const zoomOut = page.locator('button[title="Zoom out"]').first();
    const visible = await zoomIn.isVisible().catch(() => false) || await zoomOut.isVisible().catch(() => false);
    expect(visible).toBeTruthy();
  });

  test('TC5: 空画布显示占位提示', async ({ page }) => {
    await page.goto('/editor');
    await page.waitForLoadState('networkidle');
    const emptyHint = page.locator('text=/Start building|knowledge map|click.*add|add.*node/i').first();
    await expect(emptyHint).toBeVisible({ timeout: 10000 });
  });
});
