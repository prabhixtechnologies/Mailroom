import { defineConfig, devices } from "@playwright/test";

/**
 * Local smoke journeys with deterministic API/auth stubs (`e2e/fixtures.ts`).
 * Specs always run; live stack checks stay behind `E2E_LIVE=1`.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5175",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_SKIP_WEB_SERVER
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:5175",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
