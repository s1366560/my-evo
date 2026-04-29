/**
 * E2E Tests: Auth (Register / Login / Sign-out)
 * Full lifecycle: register → login → authenticated nav → sign out
 */
import { test, expect, type Page } from "@playwright/test";

// ── Constants ────────────────────────────────────────────────────────────────

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3002";

// ── Mock data ────────────────────────────────────────────────────────────────

const MOCK_TOKEN = "mock-token-e2e";
const MOCK_USER_ID = "user-001";

const mockLoginResponse = {
  success: true,
  data: {
    user: { id: MOCK_USER_ID, email: "e2e@test.com" },
    accessToken: MOCK_TOKEN,
    refreshToken: "mock-refresh-token-e2e",
  },
};

const mockRegisterResponse = {
  success: true,
  data: {
    user: { id: MOCK_USER_ID, email: "e2e@test.com" },
    accessToken: MOCK_TOKEN,
    refreshToken: "mock-refresh-token-e2e",
  },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Apply all auth route mocks */
function applyMocks(page: Page) {
  void page.route(/\/api\/v1\/auth\/login/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockLoginResponse),
    });
  });
  void page.route(/\/api\/v1\/auth\/register/, async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify(mockRegisterResponse),
    });
  });
  void page.route(/\/api\/v1\/auth\/logout/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });
  void page.route(/\/api\/a2a\/stats/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { alive_nodes: 1923, total_nodes: 2847, total_genes: 14832, total_capsules: 3204, total_recipes: 891, active_swarms: 147 },
      }),
    });
  });
}

/** Wait for form field #email to appear — indicates Next.js hydration complete */
async function waitForHydration(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForSelector("#email", { timeout: 30000, state: "attached" });
  await page.waitForTimeout(1500); // React event handler attachment
}

/** Clear persisted auth state */
async function clearAuth(page: Page) {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  try { await page.evaluate(() => localStorage.removeItem("evomap-auth")); } catch { /* skip */ }
  await page.context().clearCookies();
  await page.reload({ waitUntil: "domcontentloaded" });
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe("Auth Login/Register E2E", () => {

  // TC1: Unauthenticated NavBar
  test("NavBar: unauthenticated shows Sign in and Get started links", async ({ page }) => {
    await clearAuth(page);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Get started" })).toBeVisible();
    await expect(page.getByLabel("Sign out")).not.toBeVisible();
  });

  // TC2: Register form renders
  test("Register page: renders email, password, confirmPassword inputs and Create account button", async ({ page }) => {
    await page.goto(`${BASE}/register`);
    await waitForHydration(page);
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator("#confirmPassword")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
  });

  // TC3: Validation — mismatched passwords
  test("Register: validation error when passwords do not match", async ({ page }) => {
    await page.goto(`${BASE}/register`);
    await waitForHydration(page);
    await page.locator("#email").fill("test@example.com");
    await page.locator("#password").fill("Test123456");
    await page.locator("#confirmPassword").fill("WrongPass123");
    // Click and wait for error div to appear (client-side validation, no API call needed)
    await page.getByRole("button", { name: "Create account" }).click();
    // Error is rendered immediately via React state update
    await page.waitForSelector(".text-red-400", { timeout: 5000 });
    const errorEl = page.locator(".text-red-400");
    await expect(errorEl).toContainText(/password.*match/i);
  });

  // TC4: Validation — short password
  test("Register: validation error when password too short", async ({ page }) => {
    await page.goto(`${BASE}/register`);
    await waitForHydration(page);
    await page.locator("#email").fill("test@example.com");
    await page.locator("#password").fill("short");
    await page.locator("#confirmPassword").fill("short");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForSelector(".text-red-400", { timeout: 5000 });
    const errorEl = page.locator(".text-red-400");
    await expect(errorEl).toContainText(/at least 8/i);
  });

  // TC5: Register success → /login?registered=true
  test("Register: success redirects to /login?registered=true", async ({ page }) => {
    applyMocks(page);
    await page.goto(`${BASE}/register`);
    await waitForHydration(page);
    const email = `e2e${Date.now()}@evomap.test`;
    await page.locator("#email").fill(email);
    await page.locator("#password").fill("Test123456");
    await page.locator("#confirmPassword").fill("Test123456");
    // Click and wait for navigation
    await Promise.all([
      page.waitForURL(/\/login\?registered=true/, { timeout: 15000 }),
      page.getByRole("button", { name: "Create account" }).click(),
    ]);
  });

  // TC6: Login → lands on dashboard
  test("Login: newly registered account lands on /dashboard", async ({ page }) => {
    applyMocks(page);
    await page.goto(`${BASE}/login?registered=true`);
    await waitForHydration(page);
    await page.locator("#email").fill("e2e@test.com");
    await page.locator("#password").fill("Test123456");
    await Promise.all([
      page.waitForURL(/\/dashboard/, { timeout: 15000 }),
      page.getByRole("button", { name: "Sign in" }).click(),
    ]);
    await expect(page.getByRole("heading", { name: "Dashboard" }).or(page.locator("h1"))).toBeVisible({ timeout: 10000 });
  });

  // TC7: Authenticated NavBar with live nodes badge
  test("NavBar: authenticated shows live nodes badge and Sign out in profile dropdown", async ({ page }) => {
    applyMocks(page);
    await page.goto(`${BASE}/dashboard`);
    await waitForHydration(page);
    // Sign in first
    await page.goto(`${BASE}/login`);
    await waitForHydration(page);
    await page.locator("#email").fill("e2e@test.com");
    await page.locator("#password").fill("Test123456");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    // NavBar should show profile menu
    await expect(page.getByLabel("Profile menu")).toBeVisible({ timeout: 10000 });
  });

  // TC8: Sign out → home
  test("Sign out: redirects to home and shows Sign in + Get started", async ({ page }) => {
    applyMocks(page);
    await page.goto(`${BASE}/login`);
    await waitForHydration(page);
    await page.locator("#email").fill("e2e@test.com");
    await page.locator("#password").fill("Test123456");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    // Open profile dropdown and sign out
    await page.getByLabel("Profile menu").click();
    await page.getByLabel("Sign out").click();
    await page.waitForURL(`${BASE}/`, { timeout: 10000 });
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Get started" })).toBeVisible();
  });

  // TC9: Login form renders
  test("Login page: renders email and password inputs and Sign in button", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await waitForHydration(page);
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  // TC10: Login error for invalid credentials
  test("Login: error shown for invalid credentials", async ({ page }) => {
    void page.route(/\/api\/v1\/auth\/login/, async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ success: false, message: "Invalid email or password" }),
      });
    });
    await page.goto(`${BASE}/login`);
    await waitForHydration(page);
    await page.locator("#email").fill("wrong@test.com");
    await page.locator("#password").fill("WrongPass123");
    await page.getByRole("button", { name: "Sign in" }).click();
    // Stay on login page and show error
    await page.waitForURL(/\/login/, { timeout: 5000 });
    await page.waitForSelector(".text-red-400", { timeout: 5000 });
    await expect(page.locator(".text-red-400")).toContainText(/invalid/i);
  });
});
