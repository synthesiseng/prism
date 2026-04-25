import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CanvasRuntime } from "./index";

type PackageJson = Readonly<{
  exports: Record<string, unknown>;
}>;

const packageRoot = new URL("../../../", import.meta.url);
const distRoot = new URL("../dist/", import.meta.url);

describe("package shape", () => {
  it("keeps the package exports constrained to the public root", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("package.json", packageRoot), "utf8")
    ) as PackageJson;

    expect(Object.keys(packageJson.exports).sort()).toEqual([".", "./package.json"]);
    expect(packageJson.exports["."]).toEqual({
      types: "./packages/html-canvas/dist/index.d.ts",
      import: "./packages/html-canvas/dist/index.js"
    });
    expect(CanvasRuntime).toBeTypeOf("function");
  });

  it("does not leave test artifacts in the runtime dist output", () => {
    if (!existsSync(distRoot)) {
      return;
    }

    expect(findTestArtifacts(distRoot.pathname)).toEqual([]);
  });
});

function findTestArtifacts(directory: string): string[] {
  const matches: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      matches.push(...findTestArtifacts(path));
      continue;
    }
    if (/\.(test|spec)\./u.test(entry.name)) {
      matches.push(path);
    }
  }
  return matches.sort();
}
