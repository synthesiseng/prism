# Prism Composer Lite

Prism Composer Lite is a small example app that shows HTML/CSS components used as movable, transformable, exportable canvas surfaces.

It is intentionally narrow. The app is not a full design tool; it exists to demonstrate how a React application can keep normal document state while Prism owns HTML-in-Canvas registration, paint lifecycle, coordinate conversion, and export readiness.

## What This Shows

- Three normal HTML/CSS templates: hero, docs, and code.
- A fixed-size canvas composition stage.
- Surface selection, moving, resizing, rotation, and z-order changes.
- Prism-managed surface registration and cleanup.
- Canvas export after `document.fonts.ready` and `runtime.paintOnce()`.

## Requirements

This example depends on native HTML-in-Canvas support.

Use a Chromium build with the `canvas-draw-element` flag enabled:

```text
chrome://flags/#canvas-draw-element
```

Without native support, the app shows a support gate instead of pretending the lower-fidelity compatibility path is equivalent.

## Run

From the repository root:

```sh
pnpm install
pnpm --filter @prism/composer-lite dev
```

Then open the local dev-server URL shown by Vite.

## How It Uses Prism

Composer app code owns:

- template metadata
- document state
- selection state
- move, resize, and rotate controls
- inspector controls
- export button state

Prism owns:

- `CanvasRuntime`
- `CanvasSurface` registration
- paint lifecycle
- invalidation
- CSS-pixel surface bounds
- CSS-to-backing-store conversion
- paint readiness through `paintOnce()`
- surface cleanup

The app uses `CanvasRuntime`, `registerSurface()`, `onPaint()`, and `paintOnce()`.
It never calls raw HTML-in-Canvas browser APIs such as `layoutsubtree`, `onpaint`,
`requestPaint()`, or `drawElementImage()` directly because Prism owns those
platform details.

## Export Flow

The export path is deliberately small:

```ts
await document.fonts.ready;
await runtime.paintOnce();
canvas.toBlob(callback, "image/png");
```

`paintOnce()` only waits for a Prism-owned paint pass. PNG creation still uses the normal canvas export API.

## Source Guide

- `src/app.tsx` wires Composer state to Prism painting and export.
- `src/stage.tsx` renders the canvas and the HTML surface children.
- `src/prism/usePrismRuntime.ts` creates and destroys the Prism runtime.
- `src/prism/usePrismSurface.ts` registers HTML elements as Prism surfaces.
- `src/composer/state.ts` contains serializable document defaults and layer helpers.
- `src/composer/export.ts` contains the PNG export flow.
- `src/templates/registry.tsx` contains the example HTML/CSS templates.

## Accessibility Notes

The templates remain real DOM while registered as Prism surfaces, so text, focus, and form-style semantics can be authored with normal HTML. This example keeps the interaction model small: the canvas workspace is pointer-first, while the surface content itself remains focusable DOM.

## Non-Goals

This example does not include infinite canvas, grouping, multi-select, undo/redo, asset upload, timeline animation, or collaboration. Those are product features, not Prism runtime requirements.
