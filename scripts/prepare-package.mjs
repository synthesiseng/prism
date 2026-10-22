import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageRoots = [
  path.join(repoRoot, "packages/html-canvas/dist"),
  path.join(repoRoot, "packages/core/dist"),
  path.join(repoRoot, "packages/math/dist")
];

const packageEntrypoints = new Map([
  ["@prism/core", path.join(repoRoot, "packages/core/dist/index.js")],
  ["@prism/math", path.join(repoRoot, "packages/math/dist/index.js")]
]);

// Publish one package from selected workspace builds, so workspace-only
// imports must become relative paths inside the tarball.
for (const root of packageRoots) {
  await cleanAndRewrite(root);
}

async function cleanAndRewrite(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      await cleanAndRewrite(entryPath);
      continue;
    }

    if (shouldRemove(entry.name)) {
      await rm(entryPath);
      continue;
    }

    if (entry.name.endsWith(".js") || entry.name.endsWith(".d.ts")) {
      await rewriteFile(entryPath);
    }
  }
}

function shouldRemove(fileName) {
  // Keep the alpha tarball small and avoid publishing tests/build metadata.
  return (
    fileName.endsWith(".map") ||
    fileName.endsWith(".tsbuildinfo") ||
    fileName.includes(".test.")
  );
}

async function rewriteFile(filePath) {
  let contents = await readFile(filePath, "utf8");
  contents = contents.replace(/\n\/\/# sourceMappingURL=.*$/gu, "");

  for (const [specifier, target] of packageEntrypoints) {
    contents = rewriteSpecifier(contents, filePath, specifier, target);
  }

  contents = rewriteRelativeSpecifiers(contents);

  await writeFile(filePath, contents);
}

function rewriteSpecifier(contents, filePath, specifier, target) {
  const replacement = relativeSpecifier(path.dirname(filePath), target);
  return contents.replaceAll(`"${specifier}"`, `"${replacement}"`);
}

function relativeSpecifier(fromDirectory, target) {
  const relativePath = path.relative(fromDirectory, target).replaceAll(path.sep, "/");
  return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
}

function rewriteRelativeSpecifiers(contents) {
  // Node ESM requires explicit extensions; TypeScript resolves these .js paths
  // to the corresponding .d.ts files when checking packaged declarations.
  return contents.replace(
    /(from\s+["'])(\.{1,2}\/[^"']+)(["'])/gu,
    (_match, prefix, specifier, suffix) => {
      if (path.extname(specifier) !== "") {
        return `${prefix}${specifier}${suffix}`;
      }

      return `${prefix}${specifier}.js${suffix}`;
    }
  );
}
