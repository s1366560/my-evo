import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: [["list"]],
  outputDir: ".next/playwright/test-results",
  use: {
    baseURL: "http://localhost:3002",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx next dev -p 3002",
    url: "http://localhost:3002",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
