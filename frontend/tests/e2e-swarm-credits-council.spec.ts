/**
 * E2E Tests: Swarm, Credits, and Council Pages
 *
 * Verifies HTTP 200 and basic rendering for:
 * - /swarm (stats cards + sessions)
 * - /credits (balance + purchase grid)
 * - /council (member list + governance)
 */

import { test, expect } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3002";

test.describe("Swarm Page (/swarm)", () => {
  test("returns HTTP 200 and shows heading", async ({ page }) => {
    const response = await page.goto(`${BASE}/swarm`);
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: /swarm/i })
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Credits Page (/credits)", () => {
  test("returns HTTP 200 and shows heading", async ({ page }) => {
    const response = await page.goto(`${BASE}/credits`);
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: /credits/i })
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Council Page (/council)", () => {
  test("returns HTTP 200 and shows heading", async ({ page }) => {
    const response = await page.goto(`${BASE}/council`);
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: /council/i })
    ).toBeVisible({ timeout: 10000 });
  });
});
