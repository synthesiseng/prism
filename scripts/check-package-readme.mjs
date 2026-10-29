import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function assertPackageReadme(metadata, readme) {
  assert.equal(metadata.name, "@synthesisengineering/prism", "expected Prism package");
  assert.ok(typeof metadata.version === "string" && metadata.version.length > 0, "package version");
  assert.doesNotMatch(readme, /\b(?:unreleased|unpublished)\b|\bnot (?:yet )?available (?:on npm|in the registry)\b/iu,
    "Package README must not describe a release-pending state");
  const commands = [...readme.matchAll(/\b(?:npm (?:install|i)|pnpm add|yarn add|bun add)\s+([^\r\n`]+)/gu)];
  const installs = commands.flatMap(([, argumentsText]) => argumentsText.trim().split(/\s+/u))
    .filter(token => token === metadata.name || token.startsWith(`${metadata.name}@`));
  assert.ok(installs.length > 0, "README must contain an explicit Prism install command");
  for (const install of installs) assert.equal(install, `${metadata.name}@${metadata.version}`,
    "README install command must pin the exact packed package version");
}

export async function checkPackageReadme(directory) {
  const metadata = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8"));
  assertPackageReadme(metadata, await readFile(path.join(directory, "README.md"), "utf8"));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await checkPackageReadme(process.argv[2] ?? fileURLToPath(new URL("../", import.meta.url)));
  console.log("Package README version and release wording: PASS");
}
