# Prism Atelier

Prism Atelier demonstrates DOM-authored visual surfaces as canvas material. The
source artwork is ordinary HTML/CSS/SVG. Prism registers those DOM nodes as
surfaces, and the app composes them repeatedly in a canvas paint pass to create
generative artwork.

This is not a card or panel example. The registered DOM nodes are the artwork
source: a typographic HTML/CSS word surface, an inline SVG glyph, a CSS gradient
surface, and an SVG/CSS pattern tile. Atelier draws the selected surface many
times with canvas transforms, alpha, shadows, blend modes, and pointer-driven
offsets.

## Native Support

Prism Atelier requires native HTML-in-Canvas support.

Use a Chromium build with the Canvas Draw Element flag enabled:

```txt
chrome://flags/#canvas-draw-element
```

If native support is unavailable, the app shows a support gate instead of
pretending the fallback backend has equivalent fidelity.

## Run

From the repository root:

```sh
pnpm --filter @prism/example-atelier dev
```

Then open the local Vite URL in a flagged Chromium/Chrome Canary build.

## Build

```sh
pnpm --filter @prism/example-atelier build
```

## What Prism Owns

- `CanvasRuntime`
- source surface registration
- DOM surface lifecycle
- native paint readiness
- CSS-pixel surface bounds
- cleanup
- export readiness through `paintOnce()`

## What Atelier Owns

- creative state
- selected source and mode
- palette and seed
- pointer trail
- canvas background drawing
- repeated canvas composition
- controls and export button state

## Export Flow

Export stays on the platform canvas path:

```ts
await document.fonts.ready;
await runtime.paintOnce();
const blob = await new Promise<Blob | null>((resolve) => {
  canvas.toBlob(resolve, "image/png");
});
```

Atelier does not use screenshots, `html2canvas`, `foreignObject`, iframes,
SVG rasterization, WebGL, or WebGPU for export.

## Source Guide

- `src/main.ts` wires runtime, surfaces, input, controls, and paint.
- `src/prism/runtime.ts` creates the `CanvasRuntime`.
- `src/prism/surfaces.ts` registers DOM source surfaces.
- `src/prism/export.ts` waits for Prism paint readiness before PNG export.
- `src/atelier/state.ts` owns serializable creative state.
- `src/atelier/render.ts` orchestrates each paint pass.
- `src/atelier/modes.ts` draws Orbit, Extrude, Trail, Split, and Grid.
- `src/atelier/input.ts` records pointer movement.
- `src/ui/controls.ts` wires the bottom instrument dock.
- `src/ui/nativeGate.ts` owns the native support message.

## Non-Goals

- full editor
- SVG editor
- design tool
- asset upload
- timeline animation
- WebGL/WebGPU
- Three.js
- React
- UI library
