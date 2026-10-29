import { expect, test } from "@playwright/test";
import type {} from "../fixture/layout-fixture";

for (const scenario of [
  { name: "literal", dynamic: false, scale: 1, transform: false, dpr: 1 },
  { name: "scaled transformed DPR2", dynamic: false, scale: 0.75, transform: true, dpr: 2 },
  { name: "dynamic DPR2", dynamic: true, scale: 1.25, transform: false, dpr: 2 }
]) {
  test.describe(scenario.name, () => {
    test.use({ deviceScaleFactor: scenario.dpr });
    test("native layout sizes text before the first draw and resize snapshot", async ({ page }, testInfo) => {
      page.on("pageerror", error => { throw error; });
      await page.goto("/layout.html");
      const first = await page.evaluate(options => window.prismLayoutFixture.setup(options), scenario);
      expect(first.naturalWidth).toBeGreaterThan(420);
      let previous = first;
      for (const width of [120, 420, 280, first.naturalWidth + 100, 120.123456789]) {
        if (width === 280) expect((await page.evaluate(() => window.prismLayoutFixture.measure())).focused).toBe(true);
        const result = width === 120 ? first : await page.evaluate(
          ({ width, duringPaint }) => window.prismLayoutFixture.resize(width, duringPaint),
          { width, duringPaint: width === 280 }
        );
        await testInfo.attach(`layout-${String(width)}`, { body: JSON.stringify(result, null, 2), contentType: "application/json" });
        expect(result.width).toBe(Math.round(width));
        expect(result.height).toBe(result.bounds.height);
        expect(result.transformPreserved).toBe(true);
        expect(result.devicePixelRatio).toBe(scenario.dpr);
        expect(result.firstDraw?.width).toBe(Math.round(width));
        // Literal outside-paint bounds must draw in the first requested event.
        // Dynamic discovery and an inside-paint resize require the next snapshot.
        expect(result.firstDraw?.pass).toBe(result.beforePass + (scenario.dynamic || width === 280 ? 2 : 1));
        expect(result.firstDraw?.height).toBe(result.bounds.height);
        expect(result.firstDraw?.pixels).not.toBeNull();
        for (const box of [result.pixels, result.firstDraw!.pixels]) {
          expect(box).not.toBeNull();
          for (const key of ["x", "y", "width", "height"] as const)
            expect(Math.abs(box![key] - result.expectedPixelBox[key] * result.bitmapRatio), key).toBeLessThanOrEqual(1);
        }
        if (width === 420) expect(result.lines).toBeLessThan(first.lines);
        if (width > first.naturalWidth) {
          expect(result.width).toBeGreaterThan(first.naturalWidth);
          expect(result.lines).toBeLessThan(first.lines);
        }
        if (width === 280) {
          expect(result.lines).toBeGreaterThan(previous.lines);
          expect(result.lines).toBeLessThan(first.lines);
          expect(result.insideWidth).toBe(420);
          expect(result.focused).toBe(true);
          expect(result.firstPaint?.pass).toBe(result.beforePass + 1);
          expect(result.firstPaint?.inert).toBe(false);
          expect(result.firstPaint?.pointerEvents).toBe("auto");
          expect(result.firstPaint?.focused).toBe(true);
        }
        const clicks = (await page.evaluate(() => window.prismLayoutFixture.measure())).clicks;
        await page.mouse.click(result.clickPoint.x, result.clickPoint.y);
        await expect.poll(async () => (await page.evaluate(() => window.prismLayoutFixture.measure())).clicks).toBe(clicks + 1);
        previous = result;
      }
      const convergence = await page.evaluate(() => window.prismLayoutFixture.converge());
      await testInfo.attach("atlantic-convergence", { body: JSON.stringify(convergence), contentType: "application/json" });
      for (const sample of convergence) {
        expect(sample.width).toBe(280);
        expect(sample.height).toBe(sample.bounds.height);
        expect(sample.firstDraw?.width).toBe(280);
        expect(sample.firstDraw?.height).toBe(sample.height);
        expect(sample.lines).toBe(convergence[0]!.lines);
        expect(sample.height).toBe(convergence[0]!.height);
      }
      for (const sample of convergence.slice(1))
        expect(sample.passes - sample.beforePass).toBe(1);
      const idle = await page.evaluate(() => window.prismLayoutFixture.idle());
      await testInfo.attach("idle", { body: JSON.stringify(idle), contentType: "application/json" });
      const restored = await page.evaluate(appChanges => window.prismLayoutFixture.dispose(appChanges), scenario.dynamic);
      await testInfo.attach("restoration", { body: JSON.stringify(restored), contentType: "application/json" });
      for (const passed of Object.values(restored)) expect(passed).toBe(true);
      expect(idle.elapsedMs).toBeGreaterThanOrEqual(990);
      expect(idle.paintEvents).toBe(0);
    });
  });
}


test("content shrinks independently of prior bounds and padding stays inside the border box", async ({ page }) => {
  await page.goto("/layout.html");
  try {
    await page.evaluate(() => window.prismLayoutFixture.setup({ dynamic: false, scale: 1, transform: false }));
    const result = await page.evaluate(() => window.prismLayoutFixture.shrink());
    expect(result.longContent).toBe(700);
    expect(result.grown.height).toBe(700);
    expect(result.shortContent).toBe(20);
    expect(result.shrunk.height).toBe(180);
    expect(result.shrunk.firstDraw?.height).toBe(180);
    expect(result.shrunk.firstDraw?.pixels).not.toBeNull();
    await page.mouse.click(result.shrunk.clickPoint.x, result.shrunk.clickPoint.y);
    expect((await page.evaluate(() => window.prismLayoutFixture.measure())).clicks).toBe(1);
    await page.evaluate(() => window.prismLayoutFixture.dispose(false));
    await page.evaluate(() => window.prismLayoutFixture.setup({ dynamic: false, scale: 1, transform: false }));
    const box = await page.evaluate(() => window.prismLayoutFixture.borderBox());
    expect(box.boxSizing).toBe("border-box");
    expect(box.width).toBe(120); expect(box.height).toBe(80);
    expect(box.firstDraw?.width).toBe(120); expect(box.firstDraw?.height).toBe(80);
  } finally { await page.evaluate(() => window.prismLayoutFixture.dispose(false)); }
});
