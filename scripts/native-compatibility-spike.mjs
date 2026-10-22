import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import http from 'node:http';
import { mkdtemp, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir, release } from 'node:os';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const executablePath = process.argv[2];
const output = process.argv[3];
if (!executablePath || !output || !path.isAbsolute(output)) throw new Error('Usage: node scripts/native-compatibility-spike.mjs /absolute/browser /absolute/output.json');
const scratch = await mkdtemp(path.join(tmpdir(), 'prism-native-spike-'));
const flags = ['--enable-features=CanvasDrawElement'];
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="#ff00ff"/></svg>';
const assetServer = http.createServer((request, response) => {
  if (request.url?.includes('cors=1')) response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Content-Type', 'image/svg+xml'); response.end(svg);
});
await new Promise(resolve => assetServer.listen(0, '127.0.0.1', resolve));
const assetOrigin = `http://127.0.0.1:${assetServer.address().port}`;
const server = await createServer({
  configFile: false, root: path.join(root, 'tests/e2e/spike'), cacheDir: path.join(scratch, 'vite'),
  logLevel: 'error', resolve: { alias: Object.fromEntries([
    ['@synthesisengineering/prism', 'packages/html-canvas/src/index.ts'],
    ['@prism/core', 'packages/core/src/index.ts'], ['@prism/math', 'packages/math/src/index.ts'],
  ].map(([name, file]) => [name, path.join(root, file)])) },
  plugins: [{ name: 'synthetic-local-asset', configureServer(s) {
    s.middlewares.use('/color.svg', (_request, response) => {
      response.setHeader('Content-Type', 'image/svg+xml'); response.end(svg);
    });
  } }],
  server: { host: '127.0.0.1', port: 0, fs: { allow: [root] } },
});
let browser;
const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  executedAt: new Date().toISOString(), executablePath, flags, chromiumSandbox: true, scenarios: [], failures: [], assets: [] };
const equals = (a, b) => JSON.stringify(a) === JSON.stringify(b);
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  report.origin = origin; report.assetOrigin = assetOrigin;
  report.host = { platform: process.platform, architecture: process.arch, release: release(), node: process.version };
  report.fixtureHashes = {};
  for (const file of ['scripts/native-compatibility-spike.mjs', 'tests/e2e/spike/index.html']) {
    report.fixtureHashes[file] = createHash('sha256').update(await readFile(path.join(root, file))).digest('hex');
  }
  report.runtimeHashes = {};
  async function hashRuntime(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await hashRuntime(file);
      else if (entry.name.endsWith('.ts')) report.runtimeHashes[path.relative(root, file)] = createHash('sha256').update(await readFile(file)).digest('hex');
    }
  }
  await hashRuntime(path.join(root, 'packages/html-canvas/src'));
  browser = await chromium.launch({ executablePath, headless: true, chromiumSandbox: true, args: flags });
  report.browserVersion = browser.version();
  async function withPage(dpr, fn) {
    const context = await browser.newContext({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: dpr });
    await context.route('**/*', route => {
      const url = route.request().url();
      return url.startsWith(origin + '/') || url.startsWith(assetOrigin + '/') ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    try { await page.goto(origin); await page.waitForFunction(() => window.nativeSpike); return await fn(page); }
    finally { await context.close(); }
  }
  report.capabilities = await withPage(1, page => page.evaluate(() => window.nativeSpike.capabilities()));
  const settleFrame = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  for (const mode of ['raw', 'prism']) {
    for (const [dpr, scale, appTransform] of [[1, 1, false], [2, 1, false], [1, 1.5, false], [2, 1.5, false], [2, 1.5, true]]) {
      const row = { mode, dpr, scale, appTransform };
      await withPage(dpr, async page => {
        row.initial = await page.evaluate(options => window.nativeSpike.setup(options), { mode, scale, appTransform });
        if (row.initial.status !== 'painted') { row.geometry = 'not-exercised: initial paint failed'; return; }
        row.initialPixelsPass = equals(row.initial.pixels, { red: [255, 0, 0, 255], blue: [0, 0, 255, 255] });
        await settleFrame(page);
        row.initialImagePoint = await page.evaluate(() => window.nativeSpike.renderedButtonPoint());
        const initialPoint = appTransform && row.initialImagePoint ? row.initialImagePoint : { x: 70 * scale, y: 70 * scale };
        await page.mouse.click(initialPoint.x, initialPoint.y);
        row.initialClick = (await page.evaluate(() => window.nativeSpike.details())).clicks;
        row.relocated = await page.evaluate(() => window.nativeSpike.relocate());
        await settleFrame(page);
        row.relocatedImagePoint = await page.evaluate(() => window.nativeSpike.renderedButtonPoint());
        await page.mouse.click(initialPoint.x, initialPoint.y);
        row.oldPositionClicks = (await page.evaluate(() => window.nativeSpike.details())).clicks;
        const newPoint = appTransform && row.relocatedImagePoint ? row.relocatedImagePoint : { x: 250 * scale, y: 160 * scale };
        await page.mouse.click(newPoint.x, newPoint.y);
        row.newPositionClicks = (await page.evaluate(() => window.nativeSpike.details())).clicks;
        row.inactivePaint = await page.evaluate(() => window.nativeSpike.deactivate());
        await settleFrame(page);
        await page.mouse.click(newPoint.x, newPoint.y);
        row.inactiveClicks = (await page.evaluate(() => window.nativeSpike.details())).clicks;
        row.details = await page.evaluate(() => window.nativeSpike.details());
        row.disposal = await page.evaluate(() => window.nativeSpike.dispose());
        const near = (actual, expected) => actual && Math.hypot(actual.x - expected.x, actual.y - expected.y) <= 1.5 * scale;
        row.expectedPlacementPass = Boolean(near(row.initialImagePoint, row.initial.details.expectedButtonPoint) && near(row.relocatedImagePoint, row.relocated.details.expectedButtonPoint));
        row.geometryPass = row.expectedPlacementPass && row.initialPixelsPass && equals(row.relocated.pixels, { red: [255, 0, 0, 255], blue: [0, 0, 255, 255] }) && row.initialClick === 1 && row.oldPositionClicks === 1 && row.newPositionClicks === 2 && row.inactiveClicks === 2;
        row.imageLocatedHitParity = Boolean(row.initialImagePoint && row.relocatedImagePoint) && row.initialClick === 1 && row.oldPositionClicks === 1 && row.newPositionClicks === 2 && row.inactiveClicks === 2;
        row.transformPass = row.details.transform === row.details.initialTransform && row.disposal.transformPreserved;
      });
      report.scenarios.push(row);
    }
  }
  for (const variant of ['no-drawable', 'no-content', 'before-snapshot', 'nested-element', 'nested-canvas']) {
    report.failures.push({ variant, result: await withPage(1, page => page.evaluate(variant => window.nativeSpike.setup({ mode: 'raw', variant }), variant)) });
  }
  for (const [kind, assetUrl, assetCors, assetBackground] of [
    ['same-origin-image', `${origin}/color.svg`, false, false],
    ['cross-origin-image', `${assetOrigin}/color.svg`, false, false],
    ['cross-origin-cors-image', `${assetOrigin}/color.svg?cors=1`, true, false],
    ['cross-origin-css-url', `${assetOrigin}/color.svg`, false, true],
  ]) {
    report.assets.push({ kind, result: await withPage(1, page => page.evaluate(options => window.nativeSpike.setup(options), { mode: 'raw', assetUrl, assetCors, assetBackground })) });
  }
  report.setupFailures = [];
  for (const phase of ['decode', 'request', 'sample']) {
    report.setupFailures.push(await withPage(1, page => page.evaluate(async phase => {
      const before = document.body.children.length;
      const prototype = phase === 'decode' ? HTMLImageElement.prototype
        : phase === 'request' ? HTMLCanvasElement.prototype : CanvasRenderingContext2D.prototype;
      const method = phase === 'decode' ? 'decode' : phase === 'request' ? 'requestPaint' : 'getImageData';
      const original = prototype[method];
      prototype[method] = () => { throw new Error(`injected-${phase}`); };
      let result;
      try {
        result = await window.nativeSpike.setup({ mode: 'raw', ...(phase === 'decode' ? { assetUrl: '/color.svg' } : {}) });
      } catch (error) {
        result = { status: 'unhandled-setup-error', error: { name: error.name, message: error.message } };
      } finally { prototype[method] = original; }
      return { phase, result, remainingRoots: document.body.children.length - before };
    }, phase)));
  }
  report.ownership = await withPage(1, page => page.evaluate(() => window.nativeSpike.ownership()));
  report.coalescing = await withPage(1, async page => {
    const setup = await page.evaluate(() => window.nativeSpike.setup({ mode: 'prism' }));
    return { setup, result: await page.evaluate(() => window.nativeSpike.coalescing()) };
  });
  report.rawGeometryPass = report.scenarios.filter(r => r.mode === 'raw').every(r => r.geometryPass && r.transformPass);
} catch (error) {
  report.harnessError = { name: error.name, message: error.message, stack: error.stack };
  process.exitCode = 1;
} finally {
  await browser?.close(); await server.close();
  await new Promise(resolve => assetServer.close(resolve));
  await rm(scratch, { recursive: true, force: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ output, version: report.browserVersion, capabilities: report.capabilities,
  rawGeometryPass: report.rawGeometryPass, scenarios: report.scenarios.map(r => ({ mode: r.mode, dpr: r.dpr, scale: r.scale, appTransform: r.appTransform, paint: r.initial?.status, geometryPass: r.geometryPass, transformPass: r.transformPass, imageLocatedHitParity: r.imageLocatedHitParity })),
  ownership: report.ownership, error: report.harnessError }, null, 2));
