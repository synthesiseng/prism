import { expect, test, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import snapshot from "../../../apps/prism-atlantic/src/data/atlantic-snapshot.json" with { type: "json" };

const frames = (page: Page) => page.evaluate(() => new Promise<void>(resolve => {
  let remaining = 6;
  const step = () => --remaining ? requestAnimationFrame(step) : resolve();
  requestAnimationFrame(step);
}));

async function canvasPixels(page: Page, box: { x: number; y: number; width: number; height: number }) {
  return page.locator("#viz").evaluate(async (source: HTMLCanvasElement, box) => {
    // Keep PNG snapshot semantics without transferring the image to Node and back.
    const image = await createImageBitmap(await (await fetch(source.toDataURL())).blob());
    const canvas = document.createElement("canvas");
    canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0);
    const ratio = devicePixelRatio;
    const rgba = ctx.getImageData(Math.round(box.x * ratio), Math.round(box.y * ratio), Math.round(box.width * ratio), Math.round(box.height * ratio)).data;
    const digest = await crypto.subtle.digest("SHA-256", rgba);
    const result = {
      hash: Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join(""),
      bright: rgba.some((value, index) => index % 4 !== 3 && value > 160)
    };
    image.close();
    return result;
  }, box);
}

async function pixels(page: Page, png: Buffer, box: { x: number; y: number; width: number; height: number }) {
  return page.evaluate(async ({ data, box }) => {
    const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
    const canvas = document.createElement("canvas");
    canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0);
    const ratio = devicePixelRatio;
    const rgba = ctx.getImageData(Math.round(box.x * ratio), Math.round(box.y * ratio), Math.round(box.width * ratio), Math.round(box.height * ratio)).data;
    const digest = await crypto.subtle.digest("SHA-256", rgba);
    const result = {
      hash: Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join(""),
      bright: rgba.some((value, index) => index % 4 !== 3 && value > 160)
    };
    image.close();
    return result;
  }, { data: png.toString("base64"), box });
}

function target(name: string, width = 1440, height = 1000) {
  const storm = snapshot.storms.find(storm => storm.name === name)!;
  const points = storm.points.map(point => ({
    x: (.04 + (point.lon + 100) / 105 * .92) * width,
    y: (.06 + (1 - (point.lat - 4) / 60) * .88) * height
  }));
  const point = points.find(point => point.x > 350 && point.x < width - 370 && point.y > 220 && point.y < height - 150);
  if (!point) throw new Error(`No unobscured chart point for ${name}`);
  return { storm, point };
}

test("packaged Atlantic interaction, resize and current PNG export", async ({ page, browser }, info) => {
  test.skip(info.project.name === "unsupported", "Native journey uses the enabled platform configuration.");
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(String(error)));
  expect(browser.version()).toBe("158.0.8115.0");
  const responses: string[] = [];
  page.on("response", response => { if (response.url().includes("html-canvas/dist/index.js")) responses.push(response.url()); });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("#native-gate")).toBeHidden();
  await frames(page);
  expect(responses.length).toBeGreaterThan(0);
  const publishedModule = path.join((process.env.PRISM_PACKAGE_DIR ?? process.env.PRISM_PUBLISHED_PACKAGE_DIR)!, "packages/html-canvas/dist/index.js").replaceAll("\\", "/");
  const expectedModulePath = `/@fs/${publishedModule.replace(/^\//, "")}`;
  for (const url of responses) {
    expect(decodeURIComponent(new URL(url).pathname)).toBe(expectedModulePath);
  }
  await page.screenshot({ path: info.outputPath("initial.png") });

  // The app's filter highlights a category; it does not remove other tracks.
  await page.mouse.move(1420, 980);
  await frames(page);
  const chartBox = { x: 400, y: 250, width: 500, height: 400 };
  const unfiltered = await canvasPixels(page, chartBox);
  await page.locator('#legend [data-cat="5"]').hover();
  await frames(page);
  expect((await canvasPixels(page, chartBox)).hash === unfiltered.hash).toBe(false);
  await page.mouse.move(1420, 980);
  await frames(page);
  expect((await canvasPixels(page, chartBox)).hash === unfiltered.hash).toBe(true);
  await page.locator('#legend [data-cat="4"]').focus();
  await frames(page);
  expect((await canvasPixels(page, chartBox)).hash === unfiltered.hash).toBe(false);
  await page.keyboard.press("Tab");
  await page.locator("#export").focus();
  await frames(page);
  expect((await canvasPixels(page, chartBox)).hash).toBe(unfiltered.hash);

  const names = ["Alberto", "Gordon"];
  const exports: Buffer[] = [];
  const titleHashes: string[] = [];
  for (const name of names) {
    const { point, storm } = target(name);
    await page.mouse.click(point.x, point.y);
    await expect(page.locator("#p-name")).toHaveText(storm.name);
    await expect(page.locator("#panel")).toHaveAttribute("aria-hidden", "false");
    await expect(page.locator("#p-wind")).toHaveText(String(storm.maxWindKnots));
    // Let the initial opening animation finish; switching storms in the already-open
    // panel below still exports immediately after its content update.
    if (name === names[0]) {
      await page.waitForFunction(() => getComputedStyle(document.querySelector("#panel")!).opacity === "1");
      await frames(page);
      await page.locator("#p-name").click();
      await expect(page.locator("#panel")).toHaveAttribute("aria-hidden", "false");
    }
    // Export through the actual UI, not through a test-only runtime hook.
    const pending = page.waitForEvent("download");
    await page.locator("#export").click();
    const download = await pending;
    await expect(page.locator("#panel")).toHaveAttribute("aria-hidden", "false");
    expect(download.suggestedFilename()).toMatch(/^prism-atlantic_\d{4}-\d{2}-\d{2}\.png$/);
    const file = info.outputPath(`${name}.png`);
    await download.saveAs(file);
    const png = await readFile(file); exports.push(png);
    expect(png.readUInt32BE(16)).toBe(1440 * (info.project.use.deviceScaleFactor ?? 1));
    expect(png.readUInt32BE(20)).toBe(1000 * (info.project.use.deviceScaleFactor ?? 1));
    await info.attach(`export-${name}`, { body: png, contentType: "image/png" });
    await frames(page);
    const title = await page.locator("#p-name").boundingBox();
    expect(title).not.toBeNull();
    const exported = await pixels(page, png, title!);
    const settled = await canvasPixels(page, title!);
    expect(exported.hash === settled.hash, "exported title matches current settled title pixels").toBe(true);
    expect(exported.bright).toBe(true);
    titleHashes.push(exported.hash);
    if (titleHashes.length > 1) expect(exported.hash, "a stale prior-storm PNG must be rejected").not.toBe(titleHashes[0]);
    await expect(page.locator("#export")).toBeEnabled();
  }
  await page.locator("#panel-x").click();
  await expect(page.locator("#panel")).toHaveAttribute("aria-hidden", "true");
  // An ordinary empty-chart click must still dismiss a selection.
  const selectedAgain = target("Alberto");
  await page.mouse.click(selectedAgain.point.x, selectedAgain.point.y);
  await expect(page.locator("#panel")).toHaveAttribute("aria-hidden", "false");
  await page.mouse.click(700, 100);
  await expect(page.locator("#panel")).toHaveAttribute("aria-hidden", "true");
  expect(exports[0]!.equals(exports[1]!)).toBe(false);
  await page.setViewportSize({ width: 1200, height: 850 });
  await frames(page);
  const resized = target("Alberto", 1200, 850);
  await page.mouse.click(resized.point.x, resized.point.y);
  await expect(page.locator("#p-name")).toHaveText("Alberto");
  await expect(page.locator("#panel")).toHaveAttribute("aria-hidden", "false");
  await page.waitForFunction(() => getComputedStyle(document.querySelector("#panel")!).opacity === "1");
  await frames(page);
  const resizedChartBox = { x: 330, y: 220, width: 300, height: 350 };
  const beforeFilter = await canvasPixels(page, resizedChartBox);
  await page.locator('#legend [data-cat="5"]').focus();
  await frames(page);
  const filtered = await canvasPixels(page, resizedChartBox);
  expect(filtered.hash).not.toBe(beforeFilter.hash);
  // Clicking export blurs the transient category highlight. The downloaded chart
  // must contain that latest state, not the earlier focused-category rendering.
  const resizedPending = page.waitForEvent("download");
  await page.locator("#export").click();
  const resizedDownload = await resizedPending;
  const resizedFile = info.outputPath("resized-export.png");
  await resizedDownload.saveAs(resizedFile);
  const resizedPng = await readFile(resizedFile);
  const dpr = info.project.use.deviceScaleFactor ?? 1;
  expect(resizedPng.readUInt32BE(16)).toBe(1200 * dpr);
  expect(resizedPng.readUInt32BE(20)).toBe(850 * dpr);
  await frames(page);
  const currentChart = await canvasPixels(page, resizedChartBox);
  const exportedChart = await pixels(page, resizedPng, resizedChartBox);
  expect(exportedChart.hash).toBe(currentChart.hash);
  expect(exportedChart.hash).not.toBe(filtered.hash);
  const resizedTitle = (await page.locator("#p-name").boundingBox())!;
  expect((await pixels(page, resizedPng, resizedTitle)).hash).toBe((await canvasPixels(page, resizedTitle)).hash);
  await expect(page.locator("#panel")).toHaveAttribute("aria-hidden", "false");
  await page.screenshot({ path: info.outputPath("resized.png") });
  await writeFile(info.outputPath("resized-pixels.json"), JSON.stringify({ beforeFilter, filtered, currentChart, exportedChart }));
  await page.locator("#panel-x").click();
  await expect(page.locator("#panel")).toHaveAttribute("aria-hidden", "true");
  expect(errors).toEqual([]);
  await writeFile(info.outputPath("identity.json"), JSON.stringify({ browser: browser.version(), packageVersion: process.env.PRISM_PACKAGE_VERSION ?? "0.1.0-alpha.9", packageOrigin: process.env.PRISM_PACKAGE_ORIGIN ?? "published", loadedModuleUrls: responses, dpr: info.project.use.deviceScaleFactor, errors }, null, 2));
});


test("visible dataset dates and wind units match the committed data", async ({ page }, info) => {
  test.skip(info.project.name === "unsupported", "Native panel content requires the platform feature.");
  await page.goto("/");
  await expect(page.locator("#native-gate")).toBeHidden();
  await frames(page);
  await expect.soft(page).toHaveTitle(/2000[–-]2025/);
  await expect.soft(page.locator("#metric .sub")).toHaveText(`${String(snapshot.meta.yearStart)}-${String(snapshot.meta.yearEnd)}`);
  const { point } = target("Alberto");
  await page.mouse.click(point.x, point.y);
  await expect(page.locator("#panel")).toHaveAttribute("aria-hidden", "false");
  await expect.soft(page.locator("#p-wind + small")).toHaveText("kt");
});

test("unsupported browser shows the native composition gate", async ({ page }, info) => {
  test.skip(info.project.name !== "unsupported", "Only the deliberately disabled-feature configuration.");
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(String(error)));
  await page.goto("/");
  await expect(page.locator("#native-gate")).toBeVisible();
  await expect(page.locator("#native-gate h1")).toHaveText("Prism Atlantic requires native HTML-in-Canvas.");
  await expect(page.locator("#native-gate code")).toHaveText("chrome://flags/#canvas-draw-element");
  await expect(page.locator("#viz")).not.toHaveAttribute("content", "drawable");
  await page.screenshot({ path: info.outputPath("unsupported.png") });
  expect(errors).toEqual([]);
});

test("Atlantic measures shrinking inner content instead of its previous surface height", async ({ page }, info) => {
  test.skip(info.project.name === "unsupported", "Native sizing requires the platform feature.");
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(String(error)));
  await page.goto("/");
  await expect(page.locator("#native-gate")).toBeHidden();
  const size = () => page.locator("#metric").evaluate(element => ({
    outer: element.getBoundingClientRect().height,
    content: element.querySelector<HTMLElement>(":scope > .surface-content")!.offsetHeight,
    width: element.getBoundingClientRect().width
  }));
  await page.locator("#metric > .surface-content").evaluate(element => {
    element.replaceChildren();
    const text = document.createElement("div");
    text.style.cssText = "font:16px/20px monospace;white-space:pre";
    text.textContent = Array.from({ length: 35 }, () => "line").join("\n");
    element.append(text);
  });
  // A real existing app event invalidates the composition after the content edit.
  await page.setViewportSize({ width: 1441, height: 1000 });
  await expect.poll(async () => (await size()).content).toBe(700);
  await expect.poll(async () => (await size()).outer).toBe(728);
  const grown = await size();
  await page.locator("#metric > .surface-content > div").evaluate(element => { element.textContent = "line"; });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect.poll(async () => (await size()).content).toBe(20);
  await expect.poll(async () => (await size()).outer).toBe(180);
  const shrunk = await size();
  expect(shrunk.width).toBe(280);
  const downloaded = page.waitForEvent("download");
  await page.locator("#export").click();
  const file = info.outputPath("shrunk-export.png");
  await (await downloaded).saveAs(file);
  const png = await readFile(file);
  expect(png.readUInt32BE(16)).toBe(1440 * (info.project.use.deviceScaleFactor ?? 1));
  await frames(page);
  const region = { x: 28, y: 28, width: 280, height: 180 };
  expect((await pixels(page, png, region)).hash).toBe((await canvasPixels(page, region)).hash);
  expect(errors).toEqual([]);
  // Block wrappers fill the assigned width; they must not feed that width back as natural size.
  await page.locator("#caption").evaluate(element => { element.style.width = "500px"; });
  await page.setViewportSize({ width: 1439, height: 1000 });
  await expect.poll(() => page.locator("#caption").evaluate((element: HTMLElement) => element.offsetWidth)).toBe(250);
  await page.setViewportSize({ width: 1200, height: 850 });
  await frames(page);
  expect(await page.locator("#brand").evaluate((element: HTMLElement) => element.offsetWidth)).toBe(430);
  expect(await page.locator("#caption").evaluate((element: HTMLElement) => element.offsetWidth)).toBe(250);
  await writeFile(info.outputPath("shrink.json"), JSON.stringify({ grown, shrunk, errors }));
});
