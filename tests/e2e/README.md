# Prism E2E Lifecycle Gate

These Playwright tests protect Prism's DOM-surface lifecycle in a real browser.
They are intentionally not visual demos.

The gate checks that repeated `CanvasRuntime` create/destroy cycles restore
source DOM ownership, remove Prism-owned surface attributes and placeholder
comments, stop runtime frame loops, reject work after `destroy()`, and preserve
app-authored DOM state such as inline styles, `aria-*`, `data-*`, and
`layoutsubtree`.

Run the gate from the workspace root:

```sh
pnpm e2e
```

If the Playwright browser binary is not installed in a fresh environment, run:

```sh
pnpm exec playwright install chromium
```

The suite forces `backend: "fallback"` so it can run in ordinary CI browsers
without Chrome Canary or the `canvas-draw-element` flag.

## Optional Native Gate

The fallback gate is the CI-safe default. Native HTML-in-Canvas coverage is a
separate local gate:

```sh
pnpm e2e:native
```

The native gate forces `backend: "native"`. It does not silently fall back. If
native support is unavailable, it fails with:

```txt
Native HTML-in-Canvas backend unavailable. Enable chrome://flags/#canvas-draw-element in a Chromium build and rerun pnpm e2e:native.
```

To run it, use a Chromium build with native HTML-in-Canvas enabled:

```txt
chrome://flags/#canvas-draw-element
```

If Playwright's bundled Chromium does not expose the flag, point the native
config at a local flagged browser:

```sh
CHROME_CANARY_PATH="/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary" pnpm e2e:native
```

or:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="/path/to/flagged/chromium" pnpm e2e:native
```

The native gate verifies `backendKind === "native"`, native `paintOnce()`,
`drawElementImage()` usage, `canvas.onpaint` cleanup, Prism-owned
`layoutsubtree` cleanup, and source DOM restoration. Do not skip the fallback
lifecycle gate just because native support is unavailable.
