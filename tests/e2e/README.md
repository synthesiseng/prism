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

Optional native smoke checks should be run manually in a Chromium build with
native HTML-in-Canvas enabled:

```txt
chrome://flags/#canvas-draw-element
```

Native smoke coverage should verify the same cleanup contract, plus native
`canvas.onpaint` and Prism-owned `layoutsubtree` cleanup. Do not skip the
fallback lifecycle gate just because native support is unavailable.
