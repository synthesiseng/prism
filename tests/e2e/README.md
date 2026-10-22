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
`drawElementImage()` usage, paint-listener cleanup, Prism-owned
`content="drawable"` cleanup, and source DOM restoration. Do not skip the fallback
lifecycle gate just because native support is unavailable.


The native lifecycle check does not certify pixels or hit-testing. The separate
local compatibility fixture records these against an exact installed browser:
`node scripts/native-compatibility-spike.mjs /absolute/browser /absolute/result.json`.
A successful collection exit is not an acceptance verdict. Preserve failed results.


The native qualification workflow runs for relevant pushes to `main` and pull
requests targeting `main`: runtime/core/math sources, E2E fixtures, native
collection/assertion scripts, browser/TypeScript configuration, dependencies,
and the workflow itself. Changes limited to the root README or documentation app do not trigger it. Newer
runs cancel older runs for the same PR or branch; each job is capped at ten
minutes. The pinned macOS ARM64 browser runs with sandboxing enabled and must
pass all ten geometry/pixel/click scenarios plus native lifecycle checks.
This does not qualify Linux. Because path-filtered workflows can be skipped,
do not treat this as an unconditional required check for every PR.

Packed consumer validation is separate: `pnpm test:package` builds and packs the
actual public package into a temporary directory, then type-checks isolated ESM
consumers with NodeNext, Node16 and Bundler resolution (`skipLibCheck: false`)
and imports the packed JavaScript in Node. It uses the installed TypeScript
version, requires no dependency installation, and runs in the ordinary CI pack
job. It does not establish CommonJS support or qualify every TypeScript version.

### Native layout qualification

`layout.native.spec.ts` checks auto-sized text, fractional dimensions, growth beyond
natural width, and an Atlantic-style fixed width of 280 with measured height.
It records the first actual draw's source dimensions and pixels, checks the first
requested event for outside-paint literal changes, and checks the next snapshot
for changes discovered during paint. It verifies clicks, text reflow, application
transforms, CSS scaling, stable repeated measurement/layout, one second without
idle paint events, and conditional restoration of both width and height. Idle
observation starts immediately after one unmeasured paint settles; pixel/layout
readback in every paint callback can itself affect browser scheduling. The
Atlantic-style measurement callback remains enabled during the idle window.

DPR 2 contexts assert the reported device ratio and use the observed backing-store
ratio for pixel assertions. A context's device ratio alone does not prove a 2×
backing store; retain the measured ratio when reporting qualification.

These tests run against the configured native browser. Local results do not close
the hosted PR qualification gate or qualify another browser/OS configuration.
