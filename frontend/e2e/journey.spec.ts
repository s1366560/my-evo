import { test, expect, Page, ConsoleMessage } from '@playwright/test';

// ─── Config ───────────────────────────────────────────────────────────────────
const BASE_URL = 'http://localhost:3002';
const BACKEND_URL = 'http://localhost:3001';
const SCREENSHOT_DIR = 'test-results/e2e-journey';

const TEST_USER = {
  email: `e2e_${Date.now()}@test.com`,
  username: `e2euser_${Date.now()}`,
  password: 'Test123!@#456',
};

let consoleErrors: string[] = [];
let authToken: string | null = null;

// ─── Helper: collect console errors (page-level, not network) ─────────────────
function trackConsoleErrors(page: Page) {
  page.on('console', (msg: ConsoleMessage) => {
    // Only track ERROR level, skip warnings and network errors from external APIs
    if (msg.type() === 'error') {
      const text = msg.text();
      // Skip network/CORS errors from client-side fetch calls - these are
      // infrastructure issues, not page rendering errors
      if (
        text.includes('net::ERR_') ||
        text.includes('CORS') ||
        text.includes('Failed to load resource') ||
        text.includes('Failed to fetch') ||
        text.includes('Failed to load assets') ||
        text.includes('TypeError: Failed to fetch') ||
        text.includes('TypeError: NetworkError') ||
        text.includes('api/frontend') // skip frontend proxy errors
      ) {
        return;
      }
      consoleErrors.push(text);
    }
  });
}

// ─── Helper: screenshot ───────────────────────────────────────────────────────
async function snap(page: Page, name: string) {
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${name.replace(/\s+|\//g, '_')}.png`,
    fullPage: true,
  });
}

// ─── Test: Homepage ───────────────────────────────────────────────────────────
test('01_homepage loads without errors', async ({ page }) => {
  trackConsoleErrors(page);
  const errorsBefore = consoleErrors.length;

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await snap(page, '01-homepage');

  // Homepage should have a title
  const title = await page.title();
  expect(title.length).toBeGreaterThan(0);

  // Body should render
  const body = await page.textContent('body');
  expect(body).toBeTruthy();
  expect(body!.length).toBeGreaterThan(10);

  const newErrors = consoleErrors.slice(errorsBefore);
  expect(newErrors, `Homepage JS errors: ${newErrors.join('; ')}`).toHaveLength(0);
});

// ─── Test: Register page ─────────────────────────────────────────────────────
test('02_register page loads', async ({ page }) => {
  trackConsoleErrors(page);
  await page.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle' });
  await snap(page, '02-register-page');

  const body = await page.textContent('body');
  expect(body).toBeTruthy();
  expect(body!.length).toBeGreaterThan(10);

  // Key form inputs should be present
  const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
  await expect(emailInput).toBeVisible({ timeout: 5000 });

  const errors = consoleErrors.filter(e => !e.includes('Warning'));
  expect(errors, `Register page errors: ${errors.join('; ')}`).toHaveLength(0);
});

// ─── Test: Login page ────────────────────────────────────────────────────────
test('03_login page loads', async ({ page }) => {
  trackConsoleErrors(page);
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await snap(page, '03-login-page');

  const body = await page.textContent('body');
  expect(body).toBeTruthy();
  expect(body!.length).toBeGreaterThan(10);

  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  await expect(emailInput).toBeVisible({ timeout: 5000 });

  const errors = consoleErrors.filter(e => !e.includes('Warning'));
  expect(errors, `Login page errors: ${errors.join('; ')}`).toHaveLength(0);
});

// ─── Test: Onboarding ────────────────────────────────────────────────────────
test('04_onboarding_flow', async ({ page }) => {
  trackConsoleErrors(page);
  await page.goto(`${BASE_URL}/onboarding`, { waitUntil: 'networkidle' });
  await snap(page, '04-onboarding');

  const body = await page.textContent('body');
  expect(body).toBeTruthy();

  const errors = consoleErrors.filter(e => !e.includes('Warning'));
  expect(errors, `Onboarding errors: ${errors.join('; ')}`).toHaveLength(0);
});

// ─── Test: Browse ─────────────────────────────────────────────────────────────
test('05_browse_page loads', async ({ page }) => {
  trackConsoleErrors(page);
  await page.goto(`${BASE_URL}/browse`, { waitUntil: 'networkidle' });
  await snap(page, '05-browse-page');

  const body = await page.textContent('body');
  expect(body).toBeTruthy();
  expect(body!.length).toBeGreaterThan(10);

  const errors = consoleErrors.filter(e => !e.includes('Warning'));
  expect(errors, `Browse errors: ${errors.join('; ')}`).toHaveLength(0);
});

// ─── Test: Publish ───────────────────────────────────────────────────────────
test('06_publish_page loads', async ({ page }) => {
  trackConsoleErrors(page);
  await page.goto(`${BASE_URL}/publish`, { waitUntil: 'networkidle' });
  await snap(page, '06-publish-page');

  const body = await page.textContent('body');
  expect(body).toBeTruthy();
  expect(body!.length).toBeGreaterThan(10);

  const errors = consoleErrors.filter(e => !e.includes('Warning'));
  expect(errors, `Publish errors: ${errors.join('; ')}`).toHaveLength(0);
});

// ─── Test: Workspace ─────────────────────────────────────────────────────────
test('07_workspace_page loads', async ({ page }) => {
  trackConsoleErrors(page);
  await page.goto(`${BASE_URL}/workspace`, { waitUntil: 'networkidle' });
  await snap(page, '07-workspace-page');

  const body = await page.textContent('body');
  expect(body).toBeTruthy();
  expect(body!.length).toBeGreaterThan(10);

  const errors = consoleErrors.filter(e => !e.includes('Warning'));
  expect(errors, `Workspace errors: ${errors.join('; ')}`).toHaveLength(0);
});

// ─── Test: Marketplace ────────────────────────────────────────────────────────
test('08_marketplace_page loads', async ({ page }) => {
  trackConsoleErrors(page);
  await page.goto(`${BASE_URL}/marketplace`, { waitUntil: 'networkidle', timeout: 15000 });
  await snap(page, '08-marketplace-page');

  const body = await page.textContent('body');
  expect(body).toBeTruthy();
  expect(body!.length).toBeGreaterThan(10);

  const errors = consoleErrors.filter(e => !e.includes('Warning'));
  expect(errors, `Marketplace errors: ${errors.join('; ')}`).toHaveLength(0);
});

// ─── Test: Account ───────────────────────────────────────────────────────────
test('09_account_page loads', async ({ page }) => {
  trackConsoleErrors(page);
  await page.goto(`${BASE_URL}/account`, { waitUntil: 'networkidle' });
  await snap(page, '09-account-page');

  const body = await page.textContent('body');
  expect(body).toBeTruthy();
  expect(body!.length).toBeGreaterThan(10);

  const errors = consoleErrors.filter(e => !e.includes('Warning'));
  expect(errors, `Account errors: ${errors.join('; ')}`).toHaveLength(0);
});

// ─── Summary ──────────────────────────────────────────────────────────────────
test('10_summary_console_errors', async ({ page }) => {
  console.log(`\n=== Total page-level JS errors across journey: ${consoleErrors.length} ===`);
  if (consoleErrors.length > 0) {
    consoleErrors.forEach(e => console.log('  ERROR:', e));
  }
  expect(consoleErrors).toHaveLength(0);
});
