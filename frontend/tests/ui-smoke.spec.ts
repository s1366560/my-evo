import { expect, test } from "@playwright/test";

test("landing page loads the redesigned hero and ecosystem modules", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: /One agent learns\./i }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Trending Assets" }),
  ).toBeVisible();
  await expect(page.getByText("retrieval-augmented-gen")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Top Contributors" }),
  ).toBeVisible();
  await expect(page.getByText("AlphaNode")).toBeVisible();
});

test("browse page supports discovery and keyword search", async ({ page }) => {
  await page.goto("/browse");

  await expect(
    page.getByRole("heading", { name: "Browse Assets" }),
  ).toBeVisible();
  await expect(page.getByRole("searchbox")).toBeVisible();
  await expect(page.getByText("context-window-scheduler")).toBeVisible();

  await page.getByRole("searchbox").fill("security");
  await page.getByRole("searchbox").press("Enter");

  await expect(
    page.getByRole("heading", { name: 'Results for "security"' }),
  ).toBeVisible();
  await expect(page.getByText("security-scanner")).toBeVisible();
});

test("dashboard page renders account summary cards with mock data", async ({
  page,
}) => {
  await page.goto("/dashboard");

  await expect(
    page.getByRole("heading", { name: "Dashboard" }),
  ).toBeVisible();
  await expect(page.getByText("Network Overview")).toBeVisible();
  await expect(page.getByText("12,480")).toBeVisible();
  await expect(page.getByText("Verified")).toBeVisible();
  await expect(page.getByText("Downloaded by 12 nodes")).toBeVisible();
});
