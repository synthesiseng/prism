import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const packageDirectory = process.env.PRISM_PUBLISHED_PACKAGE_DIR;
if (!packageDirectory || !path.isAbsolute(packageDirectory)) {
  throw new Error("PRISM_PUBLISHED_PACKAGE_DIR must be an absolute extracted package directory.");
}
const metadata = JSON.parse(readFileSync(path.join(packageDirectory, "package.json"), "utf8")) as { name: string; version: string };
if (metadata.name !== "@synthesisengineering/prism" || metadata.version !== "0.1.0-alpha.9") {
  throw new Error("Atlantic qualification requires the published Prism 0.1.0-alpha.9 package.");
}
const root = fileURLToPath(new URL("../../../apps/prism-atlantic", import.meta.url));

export default defineConfig({
  root,
  cacheDir: process.env.ATLANTIC_VITE_CACHE ?? "node_modules/.vite-atlantic",
  resolve: {
    alias: [{ find: /^@synthesisengineering\/prism$/, replacement: path.join(packageDirectory, "packages/html-canvas/dist/index.js") }]
  },
  server: { fs: { allow: [root, packageDirectory] } }
});
