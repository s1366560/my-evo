import { expect, test, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3002";
const API = "http://localhost:3001";
const CLAIM_CODE = "REEF-4X7K";
const CLAIM_PATH = `/claim/${CLAIM_CODE}`;
const NODE_ID = "node-reef";

const mockLoginResponse = {
  success: true,
  data: {
    token: "mock-token-claim",
    user: { id: "user-claim", email: "claim@test.com" },
  },
};

function applySharedMocks(page: Page) {
  void page.route(`${API}/account/login`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockLoginResponse),
    });
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

function mockClaimRoute(
  page: Page,
  {
    getStatus = "available",
    postMode = "success",
  }: {
    getStatus?: "available" | "claimed";
    postMode?: "success" | "already" | "retryable";
  } = {},
) {
  void page.route(`${API}/claim/${CLAIM_CODE}`, async (route) => {
    const method = route.request().method();

    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            node_id: NODE_ID,
            model: "gpt-5.4",
            reputation: 42,
            credit_balance: 125,
            registered_at: "2026-04-01T00:00:00.000Z",
            status: getStatus,
          },
        }),
      });
      return;
    }

    if (postMode === "success") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            node_id: NODE_ID,
            model: "gpt-5.4",
            reputation: 42,
          },
        }),
      });
      return;
    }

    if (postMode === "already") {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          message: "This node has already been claimed",
        }),
      });
      return;
    }

    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        message: "Service temporarily unavailable",
      }),
    });
  });
}

function mockAgents(page: Page) {
  void page.route(`${API}/account/agents`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: [
          {
            node_id: NODE_ID,
            model: "gpt-5.4",
            status: "active",
            reputation: 42,
            credit_balance: 125,
            registered_at: "2026-04-01T00:00:00.000Z",
          },
        ],
      }),
    });
  });
}

async function clearAuthState(page: Page) {
  await page.goto(BASE);
  await page.evaluate(() => localStorage.removeItem("evomap-auth"));
  await page.context().clearCookies();
}

async function setAuthenticatedState(page: Page) {
  await page.goto(BASE);
  await page.evaluate(() => {
    localStorage.setItem(
      "evomap-auth",
      JSON.stringify({
        state: {
          token: "mock-token-claim",
          userId: "user-claim",
          isAuthenticated: true,
        },
        version: 0,
      }),
    );
  });
}

test.describe("Claim continuity flow", () => {
  test("claim link -> login -> return -> success handoff", async ({ page }) => {
    await clearAuthState(page);
    applySharedMocks(page);
    mockClaimRoute(page);
    mockAgents(page);

    await page.goto(`${BASE}${CLAIM_PATH}`);
    await expect(page.getByText("Sign in once, then finish here.")).toBeVisible();
    await page.getByRole("button", { name: "Sign in to claim" }).click();

    await expect(page).toHaveURL(/\/login\?redirect=%2Fclaim%2FREEF-4X7K%3Fresume%3D1$/);
    await expect(page.getByText("You’ll return to the same claim link after sign in.")).toBeVisible();

    await page.locator("#email").fill("claim@test.com");
    await page.locator("#password").fill("Test123456");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(`${BASE}${CLAIM_PATH}?resume=1`);
    await expect(page.getByText("You’re back at the same node.")).toBeVisible();

    await page.getByRole("button", { name: "Claim this agent" }).click();
    await expect(page.getByText("Agent claimed successfully")).toBeVisible();
    await expect(page.getByRole("link", { name: "View claimed agent" })).toBeVisible();
    await expect(page).toHaveURL(`${BASE}${CLAIM_PATH}?resume=1`);

    await page.getByRole("link", { name: "View claimed agent" }).click();
    await expect(page).toHaveURL(/\/dashboard\/agents\?claimed=node-reef/);
    await expect(page.getByText("Agent claimed successfully")).toBeVisible();
    await expect(page.getByRole("link", { name: "Review claimed node" })).toBeVisible();
  });

  test("invalid claim link is actionable", async ({ page }) => {
    await clearAuthState(page);
    applySharedMocks(page);
    mockAgents(page);
    void page.route(`${API}/claim/BAD-CODE`, async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ success: false, message: "Claim code not found" }),
      });
    });

    await page.goto(`${BASE}/claim/BAD-CODE`);
    await expect(page.getByRole("paragraph").filter({ hasText: "This claim link is no longer valid" })).toBeVisible();
    await expect(page.getByText("Ask the sender or agent for a fresh claim link").first()).toBeVisible();
    await page.getByRole("link", { name: "Sign in and review your agents" }).click();
    await expect(page).toHaveURL(/\/login\?redirect=%2Fdashboard%2Fagents$/);
    await page.locator("#email").fill("claim@test.com");
    await page.locator("#password").fill("Test123456");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(`${BASE}/dashboard/agents`);
  });

  test("already-claimed state explains what to do next", async ({ page }) => {
    await clearAuthState(page);
    mockClaimRoute(page, { getStatus: "claimed" });

    await page.goto(`${BASE}${CLAIM_PATH}`);
    await expect(page.getByText("This agent is already claimed")).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in to your agents" })).toBeVisible();
  });

  test("retryable claim failures stay recoverable", async ({ page }) => {
    await clearAuthState(page);
    applySharedMocks(page);
    mockClaimRoute(page, { postMode: "retryable" });

    await page.goto(`${BASE}${CLAIM_PATH}`);
    await page.getByRole("button", { name: "Sign in to claim" }).click();
    await page.locator("#email").fill("claim@test.com");
    await page.locator("#password").fill("Test123456");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("button", { name: "Claim this agent" }).click();

    await expect(page.getByText("We couldn’t finish the claim")).toBeVisible();
    await expect(page.getByText("Retry from this page first.")).toBeVisible();
  });

  test("stale claimed query does not fake a success banner", async ({ page }) => {
    await setAuthenticatedState(page);
    mockAgents(page);
    await page.goto(`${BASE}/dashboard/agents?claimed=fake-node`);
    await expect(page.getByText("Agent claimed successfully")).not.toBeVisible();
    await expect(page.getByText("How to Bind an Agent")).toBeVisible();
    await expect(page.getByText("Claim another agent")).not.toBeVisible();
  });
});
