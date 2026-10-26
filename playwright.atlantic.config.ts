import { defineConfig } from "@playwright/test";

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
if (!executablePath || !process.env.PRISM_PUBLISHED_PACKAGE_DIR) {
  throw new Error("Set the installed browser path and extracted published Prism package directory.");
}

export default defineConfig({
  testDir: "tests/e2e/atlantic",
  testMatch: "*.spec.ts",
  timeout: 45_000,
  workers: 1,
  reporter: "list",
  outputDir: process.env.ATLANTIC_RESULTS_DIR ?? "test-results/atlantic",
  use: {
    baseURL: "http://127.0.0.1:4189",
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
    launchOptions: { executablePath, chromiumSandbox: true, args: ["--enable-features=CanvasDrawElement"] }
  },
  webServer: {
    command: "pnpm exec vite --config tests/e2e/atlantic/vite.config.ts --host 127.0.0.1 --port 4189 --strictPort",
    url: "http://127.0.0.1:4189",
    reuseExistingServer: false
  },
  projects: [
    { name: "native-dpr1", use: { deviceScaleFactor: 1 } },
    {
      name: "native-dpr2",
      use: {
        deviceScaleFactor: 2,
        // Align ResizeObserver's physical pixel box with the emulated DPR.
        launchOptions: { executablePath, chromiumSandbox: true, args: ["--enable-features=CanvasDrawElement", "--force-device-scale-factor=2"] }
      }
    },
    {
      name: "unsupported",
      use: { launchOptions: { executablePath, chromiumSandbox: true, args: ["--disable-features=CanvasDrawElement"] } }
    }
  ]
});
