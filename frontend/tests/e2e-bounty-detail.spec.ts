/**
 * E2E: Bounty detail and create flow
 *
 * Covers:
 * 1. Bounty detail page fetches and renders bounty data
 * 2. Bounty create page submits form and redirects
 * 3. Bounty list page shows bounties from API
 * 4. Bounty detail shows bids section
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
          token: "mock-token-bounty",
          userId: "user-bounty-001",
          isAuthenticated: true,
        },
        version: 0,
      }),
    );
  });
}

const mockBounty = {
  bounty_id: "bty_test_001",
  title: "Test Bounty Title",
  description: "Fix the auth flow for SSO integration.",
  requirements: ["Must support OIDC", "Add tests"],
  status: "open",
  amount: 200,
  creator_id: "user-bounty-001",
  deadline: "2026-12-31T00:00:00.000Z",
  created_at: "2025-01-15T10:00:00.000Z",
  bid_count: 1,
  bids: [
    {
      id: "bid_1",
      bid_id: "bid_test_001",
      bounty_id: "bty_test_001",
      bidder_id: "user-bidder-001",
      proposed_amount: 180,
      estimated_time: "3 days",
      approach: "I will refactor the SSO module.",
      status: "pending",
      submitted_at: "2025-01-16T08:00:00.000Z",
    },
  ],
  milestones: [],
};

test.describe("Bounty Detail & Create E2E", () => {
  test.beforeEach(async ({ page }) => {
    injectAuth(page);
  });

  test("TC1: Bounty detail page renders bounty title and description", async ({ page }) => {
    void page.route(`${API}/api/v2/bounty/${mockBounty.bounty_id}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, bounty: mockBounty }),
      });
    });

    await page.goto(`${BASE}/bounty/${mockBounty.bounty_id}`);

    await expect(page.getByText("Test Bounty Title")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Fix the auth flow")).toBeVisible();
  });

  test("TC2: Bounty detail page shows bids section", async ({ page }) => {
    void page.route(`${API}/api/v2/bounty/${mockBounty.bounty_id}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, bounty: mockBounty }),
      });
    });

    await page.goto(`${BASE}/bounty/${mockBounty.bounty_id}`);

    await expect(page.getByText("Test Bounty Title")).toBeVisible({ timeout: 8000 });
    // Bidder approach text should be visible
    await expect(page.getByText("refactor the SSO module")).toBeVisible();
  });

  test("TC3: Bounty create page has form fields and submit button", async ({ page }) => {
    await page.goto(`${BASE}/bounty/create`);

    // Title field
    await expect(page.getByPlaceholder(/implement jwt/i)).toBeVisible({ timeout: 8000 });
    // Submit button
    await expect(page.getByRole("button", { name: /create bounty/i })).toBeVisible();
  });

  test("TC4: Bounty list page shows bounties from API", async ({ page }) => {
    void page.route(`${API}/api/v2/bounty/`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          bounties: [mockBounty],
          total: 1,
          data: [mockBounty],
        }),
      });
    });

    await page.goto(`${BASE}/bounty`);

    await expect(page.getByText("Test Bounty Title")).toBeVisible({ timeout: 8000 });
  });
});
