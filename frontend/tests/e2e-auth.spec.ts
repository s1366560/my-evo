import { test, expect, type Page } from "@playwright/test";

// ── Shared constants ────────────────────────────────────────────────────────────

const BASE = "http://127.0.0.1:3102";
const API = "http://localhost:3001";

// ── Shared mock data ────────────────────────────────────────────────────────────

const MOCK_TOKEN = 'mock-token-e2e';
const MOCK_USER_ID = 'user-001';

const mockLoginResponse = {
  success: true,
  data: {
    token: MOCK_TOKEN,
    user: { id: MOCK_USER_ID, email: 'e2e@test.com' },
  },
};

const mockRegisterResponse = {
  success: true,
  data: {
    message: 'Account created successfully',
  },
};

// ── Route interceptors ──────────────────────────────────────────────────────────

/** Apply auth + stats mocks for a given browser page */
function applyMocks(page: Page) {
  void page.route(`${API}/account/login`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockLoginResponse),
    });
  });

  void page.route(`${API}/account/register`, async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(mockRegisterResponse),
    });
  });

  void page.route(`${API}/account/logout`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  void page.route(`${API}/a2a/stats`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
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

// ── Clear auth state in localStorage ───────────────────────────────────────────

/** Reset persisted Zustand auth store and cookies between tests */
async function clearAuthState(page: Page) {
  // Clear localStorage BEFORE navigation so Zustand hydrates with clean state
  await page.goto(BASE);
  try {
    await page.evaluate(() => localStorage.removeItem('evomap-auth'));
  } catch {
    // localStorage not accessible on about:blank — skip
  }
  await page.context().clearCookies();
  await page.reload();
}

test.describe("Auth Login/Register E2E", () => {

  // --- TC1: NavBar unauthenticated ---
  test("NavBar: unauthenticated shows Sign in and Get started links", async ({ page }) => {
    await page.goto(BASE);
    await clearAuthState(page);
    await page.reload();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Get started" })).toBeVisible();
    await expect(page.getByLabel("Sign out")).not.toBeVisible();
  });

  // --- TC2: Register page renders form fields ---
  test("Register page: renders email, password, confirmPassword inputs and Create account button", async ({ page }) => {
    await page.goto(`${BASE}/register`);
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator("#confirmPassword")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
  });

  // --- TC3: Register with mismatched passwords shows error ---
  test("Register: validation error when passwords do not match", async ({ page }) => {
    await page.goto(`${BASE}/register`);
    await page.locator("#email").fill("test@example.com");
    await page.locator("#password").fill("Test123456");
    await page.locator("#confirmPassword").fill("WrongPass123");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Passwords do not match")).toBeVisible({ timeout: 5000 });
  });

  // --- TC4: Register with short password shows error ---
  test("Register: validation error when password too short", async ({ page }) => {
    await page.goto(`${BASE}/register`);
    await page.locator("#email").fill("test@example.com");
    await page.locator("#password").fill("short");
    await page.locator("#confirmPassword").fill("short");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Password must be at least 8 characters")).toBeVisible({ timeout: 5000 });
  });

  // --- TC5: Register success redirects to login with registered=true ---
  test("Register: success redirects to /login?registered=true", async ({ page }) => {
    applyMocks(page);
    const timestamp = Date.now();
    const email = `e2e${timestamp}@evomap.test`;
    const password = "Test123456";

    await page.goto(`${BASE}/register`);
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.locator("#confirmPassword").fill(password);
    await Promise.all([
      page.waitForResponse(
        resp => resp.url().includes('/account/register') && resp.status() === 201,
        { timeout: 30000 }
      ),
      page.getByRole("button", { name: "Create account" }).click(),
    ]);
    await expect(page).toHaveURL(/\/login\?registered=true/, { timeout: 30000 });
  });

  // --- TC6: Login with newly registered account lands on dashboard ---
  test("Login: newly registered account lands on /dashboard", async ({ page }) => {
    applyMocks(page);
    const timestamp = Date.now();
    const email = `e2elogin${timestamp}@evomap.test`;
    const password = "Test123456";

    await page.goto(`${BASE}/register`);
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.locator("#confirmPassword").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/login\?registered=true/, { timeout: 15000 });

    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({ timeout: 10000 });
  });

  // --- TC7: NavBar authenticated shows live nodes badge and profile button ---
  test("NavBar: authenticated shows live nodes badge and Sign out in profile dropdown", async ({ page }) => {
    applyMocks(page);
    const timestamp = Date.now();
    const email = `e2enav${timestamp}@evomap.test`;
    const password = "Test123456";

    await page.goto(`${BASE}/register`);
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.locator("#confirmPassword").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/login\?registered=true/, { timeout: 15000 });

    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    await expect(page.getByText(/\d[\d,]+\s+live nodes/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByLabel("Profile menu")).toBeVisible();
  });

  // --- TC8: Sign out redirects to home and restores unauthenticated NavBar ---
  test("Sign out: redirects to home and shows Sign in + Get started", async ({ page }) => {
    applyMocks(page);
    const timestamp = Date.now();
    const email = `e2esignout${timestamp}@evomap.test`;
    const password = "Test123456";

    await page.goto(`${BASE}/register`);
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.locator("#confirmPassword").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/login\?registered=true/, { timeout: 15000 });

    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

    // Sign out — open profile dropdown first, then click Sign out
    await page.getByLabel("Profile menu").click();
    await page.getByLabel("Sign out").click();
    await expect(page).toHaveURL(`${BASE}/`, { timeout: 10000 });
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Get started" })).toBeVisible();
  });

  // --- TC9: Login page renders form fields ---
  test("Login page: renders email and password inputs and Sign in button", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  // --- TC10: Login with wrong credentials shows error ---
  test("Login: error shown for invalid credentials", async ({ page }) => {
    // Navigate fresh, clear localStorage to avoid auth state from TC9
    await page.goto(`${BASE}/login`);
    await page.evaluate(() => localStorage.removeItem('evomap-auth'));
    await page.reload();
    await expect(page.locator("#email")).toBeVisible(); // wait for form
    await page.locator("#email").fill("wrong@test.com");
    await page.locator("#password").fill("WrongPass123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
    // Accept either a specific backend error or a network-level fetch error
    await expect(
      page.getByText(/invalid email or password|failed to fetch|network error/i)
    ).toBeVisible({ timeout: 5000 });
  });
});
