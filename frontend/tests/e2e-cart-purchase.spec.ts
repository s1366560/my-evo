/**
 * E2E: Cart → Checkout → Purchase history end-to-end flow
 *
 * Covers:
 * 1. Cart drawer opens, shows empty state
 * 2. Asset detail page has "Add to Cart" button
 * 3. Cart shows added item with correct price
 * 4. Checkout page shows balance + items + pay button
 */

import { test, expect, type Page } from "@playwright/test";

const BASE = "http://127.0.0.1:3002";
const API = "http://127.0.0.1:8001";

function injectAuth(page: Page) {
  void page.addInitScript(() => {
    window.localStorage.setItem(
      "evomap-auth",
      JSON.stringify({
        state: {
          token: "mock-token-cart",
          userId: "user-cart-001",
          isAuthenticated: true,
        },
        version: 0,
      }),
    );
  });
}

test.describe("Cart → Checkout → Purchase History", () => {
  test.beforeEach(async ({ page }) => {
    injectAuth(page);
  });

  test("TC1: Cart drawer shows empty state when no items", async ({ page }) => {
    // Clear cart store
    void page.addInitScript(() => {
      window.localStorage.removeItem("evomap-cart");
    });

    // Mock marketplace listings so the page loads
    void page.route(`${API}/api/v2/marketplace/listings`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { items: [] } }),
      });
    });

    // Open cart via the cart toggle button in the header (if present) or directly
    await page.goto(`${BASE}/marketplace`);
    // Trigger cart open by clicking cart button or evaluating store
    await page.evaluate(() => {
      const { useCartStore } = require("@/lib/stores/cart-store");
      useCartStore.getState().open();
    });

    await expect(page.locator('[data-testid="cart-drawer"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-testid="cart-empty"]')).toBeVisible();
  });

  test("TC2: Asset detail page shows Add to Cart and Buy Now buttons", async ({ page }) => {
    const assetId = "sha256:test-asset-1";

    void page.route(`${API}/api/v1/assets/${assetId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: assetId,
            title: "Test Gene Alpha",
            type: "Gene",
            description: "A test gene for e2e.",
            price: 50,
          },
        }),
      });
    });

    void page.route(`${API}/api/v1/assets/${assetId}/versions`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await page.goto(`${BASE}/asset/${assetId}`);

    await expect(page.locator('[data-testid="asset-add-to-cart"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-testid="asset-buy-now"]')).toBeVisible();
  });

  test("TC3: Checkout page shows items and total from cart store", async ({ page }) => {
    // Seed cart with an item
    void page.addInitScript(() => {
      window.localStorage.setItem(
        "evomap-cart",
        JSON.stringify({
          state: {
            items: [
              {
                assetId: "sha256:cart-item-1",
                name: "Cart Test Asset",
                price: 30,
                type: "Capsule",
                addedAt: new Date().toISOString(),
              },
            ],
            recentPurchases: [],
          },
          version: 0,
        }),
      );
    });

    // Mock auth/me for credit balance
    void page.route(`${API}/api/v1/auth/me`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: { id: "user-cart-001" }, credits: 100 }),
      });
    });

    await page.goto(`${BASE}/checkout`);

    await expect(page.locator('[data-testid="checkout-item"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-testid="checkout-total"]')).toContainText("30");
    await expect(page.locator('[data-testid="checkout-balance"]')).toContainText("100");
    await expect(page.locator('[data-testid="checkout-pay"]')).toBeVisible();
  });

  test("TC4: Purchase history page shows recent transactions", async ({ page }) => {
    // Seed recent purchase
    void page.addInitScript(() => {
      window.localStorage.setItem(
        "evomap-cart",
        JSON.stringify({
          state: {
            items: [],
            recentPurchases: [
              {
                transaction_id: "tx_001",
                amount: 30,
                asset_id: "sha256:cart-item-1",
                asset_name: "Cart Test Asset",
                status: "completed",
                purchased_at: new Date().toISOString(),
              },
            ],
          },
          version: 0,
        }),
      );
    });

    void page.route(`${API}/api/v1/assets*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    });

    await page.goto(`${BASE}/dashboard/purchases`);

    await expect(page.locator('[data-testid="purchase-history-card"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-testid="purchase-row"]')).toBeVisible();
    await expect(page.locator('[data-testid="purchase-row"]')).toContainText("tx_001");
  });
});
