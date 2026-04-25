import js from "@eslint/js";
import tsdoc from "eslint-plugin-tsdoc";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/node_modules/**",
      "eslint.config.js",
      "scripts/*.mjs",
      "apps/*/scripts/*.mjs",
      "prettier.config.cjs",
      "vitest.config.ts"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "@typescript-eslint/no-confusing-void-expression": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "tsdoc/syntax": "error"
    },
    plugins: {
      tsdoc
    }
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    ignores: ["packages/html-canvas/src/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@prism/html-canvas/runtime",
                "@prism/html-canvas/runtime/*",
                "@prism/html-canvas/src/runtime",
                "@prism/html-canvas/src/runtime/*",
                "packages/html-canvas/src/runtime",
                "packages/html-canvas/src/runtime/*",
                "**/packages/html-canvas/src/runtime",
                "**/packages/html-canvas/src/runtime/*",
                "../html-canvas/src/runtime",
                "../html-canvas/src/runtime/*",
                "../../html-canvas/src/runtime",
                "../../html-canvas/src/runtime/*",
                "../../../html-canvas/src/runtime",
                "../../../html-canvas/src/runtime/*",
                "../../packages/html-canvas/src/runtime",
                "../../packages/html-canvas/src/runtime/*",
                "../../../packages/html-canvas/src/runtime",
                "../../../packages/html-canvas/src/runtime/*",
                "../../../../packages/html-canvas/src/runtime",
                "../../../../packages/html-canvas/src/runtime/*"
              ],
              message:
                "html-canvas runtime modules are internal. Use the public @prism/html-canvas entry point and CanvasRuntime façade instead."
            }
          ]
        }
      ]
    }
  }
);
