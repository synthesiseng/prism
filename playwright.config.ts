import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e/specs",
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4177",
    trace: "on-first-retry"
  },
  testIgnore: /.*\.native\.spec\.ts/,
  webServer: {
    command: "pnpm exec vite --host 127.0.0.1 --port 4177 --config tests/e2e/vite.config.ts",
    url: "http://127.0.0.1:4177",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
