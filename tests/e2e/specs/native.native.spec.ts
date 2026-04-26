import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  installConsoleErrorGate(page);
  await page.addInitScript(() => {
    window.addEventListener("unhandledrejection", (event) => {
      console.error(`Unhandled rejection: ${String(event.reason)}`);
    });
  });
  await page.goto("/");
});

test("native backend paints a DOM surface and cleans up native canvas state", async ({
  page
}) => {
  const result = await page.evaluate(() =>
    window.prismLifecycleFixture.testNativeLifecycle()
  );

  expect(result.backendKind).toBe("native");
  expect(result.paintOnceResolved).toBe(true);
  expect(result.drawElementImageCalls).toBeGreaterThan(0);
  expect(result.canvasOnpaintInstalledWhileActive).toBe(true);
  expect(result.canvasOnpaintClearedAfterDestroy).toBe(true);
  expect(result.layoutSubtreePresentWhileActive).toBe(true);
  expect(result.layoutSubtreeRemovedAfterDestroy).toBe(true);
  expect(result.parentRestored).toBe(true);
  expect(result.styleRestored).toBe(true);
  expect(result.ariaLabelRestored).toBe(true);
  expect(result.appDataPreserved).toBe(true);
  expect(result.prismAttributeRemoved).toBe(true);
  expect(result.noRetainedPrismSurfaceElements).toBe(true);
  expect(result.noRetainedPrismComments).toBe(true);
  expect(result.noRetainedCanvases).toBe(true);
});

function installConsoleErrorGate(page: Page): void {
  page.on("console", (message) => {
    if (message.type() === "error") {
      throw new Error(`Unexpected console.error: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    throw error;
  });
}
