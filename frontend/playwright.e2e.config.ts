import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "e2e-auth.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  outputDir: ".next/playwright/test-results",
  use: {
    baseURL: "http://localhost:3002",
    trace: "retain-on-failure",
  },
  // No webServer — services already running on localhost:3002 (frontend) and :3001 (backend)
});
