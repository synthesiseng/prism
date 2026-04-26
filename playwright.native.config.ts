import { defineConfig, devices } from "@playwright/test";

const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? process.env.CHROME_CANARY_PATH;

export default defineConfig({
  testDir: "tests/e2e/specs",
  testMatch: /.*\.native\.spec\.ts/,
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4178",
    trace: "on-first-retry",
    launchOptions: {
      ...(executablePath ? { executablePath } : {})
    }
  },
  webServer: {
    command: "pnpm exec vite --host 127.0.0.1 --port 4178 --config tests/e2e/vite.config.ts",
    url: "http://127.0.0.1:4178",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  projects: [
    {
      name: "native",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
