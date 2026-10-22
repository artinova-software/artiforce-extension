import { defineConfig } from "@playwright/test";

// Loads build/chrome-e2e (pnpm build:e2e) into Chromium; supplier sites and
// the Artiforce web app are simulated with context.route (test/e2e/routes.ts).
export default defineConfig({
  testDir: "test/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: process.env["CI"] === undefined ? 0 : 1,
  reporter: process.env["CI"] === undefined ? "list" : [["list"], ["html", { open: "never" }]],
  use: { trace: "retain-on-failure" },
});
