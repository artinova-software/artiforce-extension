import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.check.ts",
  workers: 1,
  timeout: 60_000,
  reporter: "list",
});
