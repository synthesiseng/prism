import { defineConfig } from "vite";

const root = new URL("../../", import.meta.url);

export default defineConfig({
  resolve: {
    alias: {
      "@prism/assets": new URL("packages/assets/src/index.ts", root).pathname,
      "@prism/core": new URL("packages/core/src/index.ts", root).pathname,
      "@prism/input": new URL("packages/input/src/index.ts", root).pathname,
      "@prism/math": new URL("packages/math/src/index.ts", root).pathname,
      "@prism/renderer": new URL("packages/renderer/src/index.ts", root).pathname,
      "@prism/scene": new URL("packages/scene/src/index.ts", root).pathname,
      "@prism/shader-fx": new URL("packages/shader-fx/src/index.ts", root).pathname
    }
  }
});
