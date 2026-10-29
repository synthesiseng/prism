import assert from "node:assert/strict";
import { test } from "node:test";
import { assertPackageReadme } from "./check-package-readme.mjs";

const metadata = { name: "@synthesisengineering/prism", version: "0.1.0-alpha.9" };
const valid = "pnpm add @synthesisengineering/prism@0.1.0-alpha.9";
test("accepts exact version across supported install commands", () => {
  for (const command of ["pnpm add", "npm install", "npm i", "yarn add", "bun add"])
    assert.doesNotThrow(() => assertPackageReadme(metadata, valid.replace("pnpm add", command)));
});
test("rejects stale, unpinned, dist-tag and mixed-version install commands", () => {
  for (const suffix of ["@0.1.0-alpha.8", "", "@alpha", "@latest"])
    assert.throws(() => assertPackageReadme(metadata, `npm install ${metadata.name}${suffix}`), /exact packed package version/u);
  assert.throws(() => assertPackageReadme(metadata, `${valid}\nnpm install ${metadata.name}@0.1.0-alpha.8`));
  assert.throws(() => assertPackageReadme(metadata, "No installation instructions"), /explicit Prism install/u);
});
test("rejects release-state wording even when the install version matches", () => {
  for (const text of ["Unreleased candidate", "unpublished", "not available on npm yet", "not yet available in the registry"])
    assert.throws(() => assertPackageReadme(metadata, `${valid}\n${text}`), /release-pending/u);
});
