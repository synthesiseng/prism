# Prism Atlantic

Prism Atlantic is a vanilla TypeScript example that renders real Atlantic hurricane tracks on canvas while Prism manages the HTML/CSS interface surfaces.

It demonstrates the core Prism idea: a data-heavy canvas scene can use normal HTML/CSS panels as managed canvas surfaces without the app calling raw HTML-in-Canvas browser APIs directly.

## What It Shows

The base visualization is drawn with Canvas 2D:

- dark Atlantic basin background
- subtle geographic grid and coastline orientation layer
- NOAA/NHC HURDAT2 storm tracks
- intensity colors derived from wind speed in knots
- hover and selection highlighting

The interface is normal HTML/CSS managed by Prism:

- title/header
- basin overview panel
- Saffir-Simpson legend
- hover tooltip
- selected storm detail panel
- dataset caption
- PNG export button

Prism composes those registered HTML surfaces during the runtime paint pass, after the canvas chart is drawn.

## Why Prism Is Used Here

Prism Atlantic is not just "DOM over a canvas." The app keeps the chart as canvas-rendered data, while Prism owns the HTML-in-Canvas surface lifecycle.

Prism owns:

- `CanvasRuntime`
- HTML surface registration
- `CanvasSurface` cleanup
- surface bounds
- paint lifecycle
- invalidation
- paint readiness
- export timing

The Atlantic app owns:

- HURDAT2 data loading and normalization
- map projection
- storm-track geometry
- hover and click state
- selected storm state
- category filtering
- canvas drawing of coastlines and storm tracks
- HTML content for panels, legends, tooltips, and detail cards

That boundary is the point of the example. The app never calls raw platform APIs such as `layoutsubtree`, `onpaint`, `requestPaint()`, or `drawElementImage()` directly.

## Native Support

Prism Atlantic is intended to be viewed with native HTML-in-Canvas enabled in a Chromium build:

```txt
chrome://flags/#canvas-draw-element
```

Without the flag, the normal canvas chart may still render because Canvas 2D works everywhere. The HTML panels may also exist as ordinary DOM nodes in the page. That is not the same thing as native Prism composition.

The native Prism path is what makes the HTML/CSS surfaces participate in the canvas paint and export pipeline.

## Export Path

Export intentionally uses Prism readiness plus the normal canvas API:

```ts
await document.fonts.ready;
await runtime.paintOnce();
canvas.toBlob(callback, "image/png");
```

The example does not use `html2canvas`, `dom-to-image`, screenshots, iframes, or SVG `foreignObject` export.

## Data Source

Storm tracks come from the NOAA/National Hurricane Center HURDAT2 Atlantic best-track dataset:

- Archive: https://www.nhc.noaa.gov/data/hurdat/
- Snapshot used: `hurdat2-1851-2025-02272026.txt`

The example uses the NHC Atlantic HURDAT2 file published February 27, 2026, covering 1851-2025. The committed deploy snapshot filters that source to 2010-2025 for the visualization.

The app imports a compact committed snapshot at `src/data/atlantic-snapshot.json`. It contains filtered Atlantic storms from 2010-2025 with downsampled track points so Vercel and local builds do not depend on a large generated artifact. Categories are derived from HURDAT2 maximum sustained wind in knots.

The full generated local snapshot is `src/data/hurdat2-atlantic.json`. That file is intentionally ignored by Git because it contains tens of thousands of normalized HURDAT2 rows.

`src/data/coastlines.ts` is only a hand-drawn basemap/orientation layer. It is not NOAA data and is not a cartographic authority.

To regenerate the normalized snapshot from a downloaded HURDAT2 text file:

```sh
node apps/prism-atlantic/scripts/build-hurdat2-snapshot.mjs /path/to/hurdat2-atlantic.txt apps/prism-atlantic/src/data/hurdat2-atlantic.json
```

## Run

```sh
pnpm --filter @prism/example-atlantic dev
```

## Build

```sh
pnpm --filter @prism/example-atlantic build
```
