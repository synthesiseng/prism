import { defineConfig } from "vite";

const root = new URL("./fixture", import.meta.url).pathname;
const workspaceRoot = new URL("../..", import.meta.url).pathname;

export default defineConfig({
  root,
  resolve: {
    alias: {
      "@prism/core": new URL("../../packages/core/src/index.ts", import.meta.url).pathname,
      "@prism/html-canvas": new URL("../../packages/html-canvas/src/index.ts", import.meta.url).pathname,
      "@prism/math": new URL("../../packages/math/src/index.ts", import.meta.url).pathname,
      "@synthesisengineering/prism": new URL(
        "../../packages/html-canvas/src/index.ts",
        import.meta.url
      ).pathname
    }
  },
  server: {
    fs: {
      allow: [workspaceRoot]
    }
  }
});
