import { checkPackageReadme } from "./check-package-readme.mjs";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const scratch = await mkdtemp(path.join(tmpdir(), "prism-package-consumer-"));
try {
  execFileSync("npm", ["pack", "--json", "--pack-destination", scratch], {
    cwd: root,
    stdio: "inherit"
  });
  const archives = (await readdir(scratch)).filter((file) => file.endsWith(".tgz"));
  assert.equal(archives.length, 1, "exactly one public package");
  const packageRoot = path.join(scratch, "node_modules/@synthesisengineering/prism");
  await mkdir(packageRoot, { recursive: true });
  execFileSync("tar", [
    "-xzf",
    path.join(scratch, archives[0]),
    "-C",
    packageRoot,
    "--strip-components=1"
  ]);
  await checkPackageReadme(packageRoot);
  console.log("Actual packed README: PASS");
  await writeFile(
    path.join(scratch, "package.json"),
    '{"private":true,"type":"module"}\n'
  );
  await writeFile(
    path.join(scratch, "consumer.ts"),
    `
import { CanvasRuntime, PrismNativeError, LayoutConvergenceError } from "@synthesisengineering/prism";
import type { CanvasPoint, CanvasRuntimeOptions, PaintHandler } from "@synthesisengineering/prism";
const point: CanvasPoint = { x: 1, y: 2 };
const options: CanvasRuntimeOptions = { backend: "native", nativePaintTimeoutMs: 2000 };
const runtime = new CanvasRuntime(document.createElement("canvas"), options);
const surface = runtime.registerSurface(document.createElement("div"), {
  bounds: { ...point, width: 100, height: 50 }
});
const paint: PaintHandler = ({ drawSurface }) => drawSurface(surface);
runtime.onPaint(paint);
const pending: Promise<void> = runtime.paintOnce();
const failure: Error = new PrismNativeError("paint-timeout", "synthetic consumer error");
function describeFailure(error: unknown): string {
  if (error instanceof LayoutConvergenceError) {
    const narrowed: LayoutConvergenceError = error;
    return narrowed.message;
  }
  return "other";
}
void pending; void failure; void describeFailure;
// @ts-expect-error public coordinates must retain their numeric type
const invalidPoint: CanvasPoint = { x: "invalid", y: 2 };
// @ts-expect-error unsupported backend must not become any through unresolved declarations
const invalidOptions: CanvasRuntimeOptions = { backend: "invalid" };
void invalidPoint; void invalidOptions;
`
  );
  let failed = false;
  for (const [module, moduleResolution] of [
    ["NodeNext", "NodeNext"],
    ["Node16", "Node16"],
    ["ESNext", "Bundler"]
  ]) {
    await writeFile(
      path.join(scratch, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module,
          moduleResolution,
          strict: true,
          skipLibCheck: false,
          noEmit: true,
          types: [],
          lib: ["ES2022", "DOM", "DOM.Iterable"]
        },
        files: ["consumer.ts"]
      })
    );
    const result = spawnSync(
      process.execPath,
      [
        path.join(root, "node_modules/typescript/bin/tsc"),
        "--project",
        path.join(scratch, "tsconfig.json")
      ],
      { cwd: scratch, encoding: "utf8" }
    );
    if (result.error) throw result.error;
    console.log(`${moduleResolution}: ${result.status === 0 ? "PASS" : "FAIL"}`);
    if (result.status !== 0) {
      failed = true;
      console.error(result.stdout + result.stderr);
    }
  }
  execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    import assert from 'node:assert/strict';
    import { CanvasRuntime, PrismNativeError, LayoutConvergenceError } from '@synthesisengineering/prism';
    assert.equal(typeof CanvasRuntime, 'function');
    assert.equal(typeof PrismNativeError, 'function');
    const layout = new LayoutConvergenceError();
    assert.ok(layout instanceof LayoutConvergenceError);
    assert.ok(layout instanceof Error);
    assert.equal(layout instanceof PrismNativeError, false);
    assert.equal(layout.name, 'LayoutConvergenceError');
  `
    ],
    { cwd: scratch, stdio: "inherit" }
  );
  console.log("Packed Node ESM import: PASS");
  assert.equal(failed, false, "all packed declaration consumer modes must pass");
} finally {
  await rm(scratch, { recursive: true, force: true });
}
