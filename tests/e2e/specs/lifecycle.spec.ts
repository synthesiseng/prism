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

test("repeated create/destroy cycles restore DOM and leave no Prism state behind", async ({
  page
}) => {
  const results = await page.evaluate(() =>
    window.prismLifecycleFixture.runCreateDestroyCycles(30)
  );

  expect(results).toHaveLength(30);
  for (const result of results) {
    expect(result.backendKind).toBe("fallback");
    expect(result.retainedPrismSurfaceElements).toBe(0);
    expect(result.retainedPrismComments).toBe(0);
    expect(result.retainedCanvases).toBe(0);
    expect(result.restoredElements).toBe(4);
    expect(result.canvasOnpaintCleared).toBe(true);
    expect(result.preservedAppLayoutSubtree).toBe(true);
    expect(result.clearedRuntimeLayoutSubtree).toBe(true);
  }
});

test("disposed surfaces restore DOM and reject disposed operations", async ({ page }) => {
  const result = await page.evaluate(() =>
    window.prismLifecycleFixture.testDisposedSurfaceBehavior()
  );

  expect(result).toEqual({
    isDisposed: true,
    parentRestored: true,
    styleRestored: true,
    prismAttributeRemoved: true,
    getBoundsThrew: true,
    setBoundsThrew: true,
    drawDisposedRejected: true
  });
});

test("destroyed runtime rejects new work but keeps stop and destroy idempotent", async ({
  page
}) => {
  const result = await page.evaluate(() =>
    window.prismLifecycleFixture.testDestroyedRuntimeBehavior()
  );

  expect(result).toEqual({
    startThrew: true,
    onPaintThrew: true,
    onUpdateThrew: true,
    registerSurfaceThrew: true,
    paintOnceRejected: true,
    stopIdempotent: true,
    destroyIdempotent: true
  });
});

test("destroy stops runtime update and paint loop", async ({ page }) => {
  const result = await page.evaluate(() =>
    window.prismLifecycleFixture.testNoPaintLoopAfterDestroy()
  );

  expect(result.updateCountBeforeDestroy).toBeGreaterThanOrEqual(2);
  expect(result.paintCountBeforeDestroy).toBeGreaterThanOrEqual(2);
  expect(result.updateCountAfterDestroy).toBe(result.updateCountBeforeDestroy);
  expect(result.paintCountAfterDestroy).toBe(result.paintCountBeforeDestroy);
  expect(result.stopped).toBe(true);
});

test("bounds updates and canvas resizes clean up source DOM", async ({ page }) => {
  const result = await page.evaluate(() =>
    window.prismLifecycleFixture.testResizeBoundsCleanup()
  );

  expect(result).toEqual({
    parentRestored: true,
    styleRestored: true,
    prismAttributeRemoved: true,
    noRetainedCanvasChildren: true,
    noRetainedPrismComments: true
  });
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
