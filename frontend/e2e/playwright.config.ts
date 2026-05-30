import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3002",
    trace: "retain-on-failure",
  },
});
