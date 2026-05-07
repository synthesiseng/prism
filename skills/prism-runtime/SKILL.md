---
name: prism-runtime
description: "Use when building canvas applications with Prism: registering HTML/CSS/SVG DOM nodes as canvas surfaces, composing DOM-authored visuals in Canvas 2D workflows, integrating Prism with React or vanilla apps, or exporting after Prism paint readiness. Prevents common mistakes like html2canvas export, raw drawElementImage/requestPaint calls, deep imports, handler registration inside render loops, and CSS/backing-pixel mixups."
---

# Prism Runtime

Prism is a native-first HTML-in-Canvas runtime for managed DOM surfaces in canvas applications. Prism does not replace the renderer.

Apps own scene logic, drawing model, animation loop, app state, chart/game/rendering logic, templates, transforms, and interaction rules.

Prism owns DOM surface registration, CSS-pixel bounds, paint lifecycle, invalidation, paint readiness, coordinate helpers, and cleanup.

## Approach

### Discovery

Before writing code, briefly establish:

- What is the app drawing on canvas: chart, scene, generative art, editor/composer, or UI?
- What needs to be DOM instead of canvas: text, controls, SVG, React components, styled cards, or rich layout?
- Is this continuous animation or a one-shot render/export? This decides `start()` vs `paintOnce()`.
- Does the app need PNG export?
- Does native fidelity matter? If yes, the app needs a native support gate.

For specific edits, skip discovery and inspect the relevant files.

### Step 1: Establish the boundary

Before writing code, identify:

- App owns data, scene state, pointer state, animation loop, and drawing decisions.
- Prism owns DOM-surface lifecycle and paint readiness.
- Canvas receives the composed frame.

### Step 2: Author source surfaces

Use real DOM nodes as source material:

- HTML
- CSS
- SVG
- React-rendered DOM
- ordinary DOM controls or visual elements

Do not recreate DOM visuals as canvas/SVG strings unless the app actually needs static vector assets.

### Step 3: Register surfaces

Register source DOM nodes through `runtime.registerSurface()`.

### Step 4: Compose in the paint pass

Draw app-owned canvas content first, then call `drawSurface(surface)` inside `runtime.onPaint()`.

### Step 5: Export readiness

If exporting, use:

assets loaded/decoded -> `document.fonts.ready` -> `runtime.paintOnce()` -> `canvas.toBlob()`

### Step 6: Cleanup

Dispose surfaces and destroy the runtime during teardown.

```ts
const label = document.createElement("div");
label.className = "storm-label";
label.textContent = "FELIX · CAT 3";
document.body.appendChild(label);

const runtime = new CanvasRuntime(canvas, { backend: "auto" });
const labelSurface = runtime.registerSurface(label, {
  bounds: { x: 460, y: 180, width: 140, height: 32 }
});

runtime.onPaint(({ ctx, drawSurface }) => {
  drawStormTrack(ctx);
  drawSurface(labelSurface);
});

runtime.start();
```

The app owns the storm track drawing and label content. Prism owns the label surface lifecycle and paint readiness.

<HARD-GATE>
Before writing Prism integration code, verify:
1. The app needs live DOM/CSS/SVG source surfaces, not just static SVG/image assets.
2. The app owns the renderer, scene, animation loop, and interaction rules.
3. Prism owns only DOM-surface lifecycle and paint readiness.
4. Imports come from `@synthesisengineering/prism`.
5. Export does not use screenshots, `html2canvas`, `dom-to-image`, iframe capture, or `foreignObject`.
6. Native fidelity requirements are explicit.
</HARD-GATE>

## Surface Boundary Before Paint

Define every source surface at its stable app-owned DOM state before composing it in canvas.

1. Author the DOM source first.
2. Give it explicit CSS-pixel bounds.
3. Register it through `runtime.registerSurface()`.
4. Draw it only inside `onPaint()`.
5. Add transforms, effects, repetition, or composition in canvas around `drawSurface()`.

Do not start by rewriting the DOM source as custom canvas drawing code. The DOM source is the material.

## Use Prism When

Use Prism for:

- Canvas 2D apps with DOM-authored labels, legends, annotations, controls, or creative surfaces.
- Data visualizations with rich HTML/CSS surfaces.
- Creative tools using HTML/CSS/SVG as visual material.
- React or vanilla apps that need DOM components composed into canvas.
- Export workflows that need a paint-ready canvas frame.

## Do Not Use Prism For

Do not use Prism as:

- canvas engine
- UI kit
- design tool
- app framework
- charting library
- game engine
- WebGL/WebGPU integration layer today
- screenshot/export library

Do not use Prism just to draw static SVG/image assets. If the source is static and does not need DOM/CSS lifecycle, use the asset directly.

## Install

```sh
pnpm add @synthesisengineering/prism
```

## Imports

Always import from the package root:

```ts
import { CanvasRuntime } from "@synthesisengineering/prism";
import type {
  CanvasSurface,
  CanvasRuntimeOptions,
  SurfaceOptions,
  SurfaceBoundsInput,
  PaintHandler,
  UpdateHandler,
  CanvasPoint
} from "@synthesisengineering/prism";
```

Do not deep import runtime internals, backend classes, paint-pass helpers, or native platform wrappers.

## Basic Runtime Pattern

```ts
const runtime = new CanvasRuntime(canvas, { backend: "auto" });
const surface = runtime.registerSurface(element, {
  bounds: { x: 0, y: 0, width: 320, height: 180 }
});

runtime.onPaint(({ drawSurface }) => {
  drawSurface(surface);
});

runtime.start();
```

`onPaint()` is additive. Register stable handlers during setup; do not register a new paint handler every frame or every React render.

## `start()` vs `paintOnce()`

Use `start()` for continuous animation or interactive scenes.

Use `paintOnce()` when you need one paint-ready frame, especially before export.

`paintOnce()` works without `start()`.

## Runtime Properties

Useful public properties:

- `runtime.canvas`
- `runtime.width`
- `runtime.height`
- `runtime.pixelRatio`
- `runtime.backendKind`

Use `runtime.backendKind` to check whether the selected backend is `"native"` or `"fallback"`.

## Paint Pass Pattern

```ts
runtime.onPaint(({ ctx, drawSurface }) => {
  drawBackground(ctx);
  drawSceneOrChart(ctx);
  drawSurface(labelSurface);
  drawSurface(legendSurface);
});
```

`drawSurface()` is scoped to the paint pass. Do not store it for later.

## `onUpdate()` Pattern

Use `onUpdate()` for frame/update state, not surface drawing.

```ts
runtime.onUpdate(({ delta }) => {
  state.time += delta;
});

runtime.onPaint(({ ctx, drawSurface }) => {
  drawAnimatedBackground(ctx, state.time);
  drawSurface(surface);
});
```

## Exporting a PNG

```ts
await document.fonts.ready;
await runtime.paintOnce();

const blob = await new Promise<Blob | null>((resolve) => {
  canvas.toBlob(resolve, "image/png");
});
```

- `paintOnce()` waits for one Prism-owned paint pass.
- It does not export image data.
- PNG creation still uses normal canvas APIs.
- If surfaces depend on images, videos, fonts, or decoded assets, load/decode those before `paintOnce()`.

For Prism-composited exports, use this sequence:

1. Load/decode assets.
2. `await document.fonts.ready`.
3. `await runtime.paintOnce()`.
4. `canvas.toBlob(...)`.

## Coordinate Spaces

- Surface bounds use CSS pixels.
- Direct `ctx` drawing uses backing-store pixels.
- Use Prism helpers when aligning canvas drawing with surface coordinates.

```ts
surface.setBounds({ x: 24, y: 32, width: 360, height: 220 });

const point = runtime.cssPointToCanvasPixels({ x: 24, y: 32 });
const size = runtime.cssLengthToCanvasPixels(12);
```

## Invalidation

Use `runtime.invalidate()` when app-owned state changes and Prism would not otherwise know.

Examples:

- pointer state changes a canvas composition
- app data changes manual canvas drawing
- DOM content changes outside Prism APIs
- selected mode/palette changes rendering state

Some Prism APIs invalidate automatically, such as `surface.setBounds()` outside an active paint pass.

## Lifecycle

```ts
surface.dispose();
// or
runtime.unregisterSurface(surface);

runtime.destroy();
```

Destroying a runtime disposes registered surfaces.

After disposal:

- `surface.isDisposed === true`
- `surface.getBounds()` throws
- `surface.setBounds()` throws
- `surface.dispose()` remains idempotent

After runtime destroy:

- `start()` throws
- `onPaint()` throws
- `onUpdate()` throws
- `registerSurface()` throws
- `paintOnce()` rejects
- `stop()` and `destroy()` remain idempotent

Do not reuse destroyed runtimes.

## Callback Semantics

- `onPaint()` and `onUpdate()` are additive.
- Each call registers another handler.
- They do not replace previous handlers.
- Prism does not currently expose a general event system or unsubscribe API.
- Register stable handlers and coordinate app state outside Prism.

## Native Support

Native HTML-in-Canvas currently requires Chromium or Chrome Canary with:

```txt
chrome://flags/#canvas-draw-element
```

```ts
if (runtime.backendKind !== "native") {
  showNativeSupportGate();
}
```

Fallback can be useful for development and compatibility checks, but native-fidelity examples should show a support gate when `runtime.backendKind !== "native"`.

Fallback is compatibility-only and lower fidelity. Do not present fallback as equivalent to native HTML rendering.

## Rules (Non-Negotiable)

1. Import Prism only from `@synthesisengineering/prism`.
2. Do not deep import internals.
3. Do not call raw `layoutsubtree`, `onpaint`, `requestPaint()`, or `drawElementImage()` in app code.
4. Do not use `html2canvas`, `dom-to-image`, iframe screenshots, or `foreignObject` export.
5. Surface bounds are CSS pixels.
6. Direct `ctx` drawing uses backing-store pixels.
7. Do not store `drawSurface()` for later.
8. Do not register `onPaint()` / `onUpdate()` inside render loops, pointer handlers, or React render bodies.
9. Do not store `CanvasRuntime` or `CanvasSurface` in serializable document/framework state.
10. For export, always wait for `document.fonts.ready` and `runtime.paintOnce()` before `canvas.toBlob()`.
11. Destroyed runtimes are not reusable.
12. Fallback is compatibility-only and lower fidelity.

## Forbidden Patterns

Quick scan:

- raw platform APIs
- screenshot/export libraries
- deep imports
- export before `paintOnce()`
- storing `drawSurface()`
- storing runtime/surfaces in serializable state

Do not use screenshot/export libraries such as `html2canvas`, `dom-to-image`, iframe screenshotting, or `foreignObject` export.

Do not call raw platform APIs in app code:

```ts
canvas.onpaint = ...
canvas.requestPaint()
ctx.drawElementImage(...)
```

Do not deep import internals:

```ts
import { NativeBackend } from "@synthesisengineering/prism/...";
```

Do not call `canvas.toBlob()` before `document.fonts.ready` and `runtime.paintOnce()` for Prism-composited exports.

Do not store `drawSurface()` for later.

Do not store `CanvasRuntime` or `CanvasSurface` in serializable document/framework state.

## Recommended App Structure

```txt
src/
  main.ts
  prism/
    runtime.ts
    surfaces.ts
    export.ts
  app/
    state.ts
    render.ts
    input.ts
  ui/
    controls.ts
```

Use `scene/`, `chart/`, or `composer/` instead of `app/` when that name better matches the project.

App state should remain serializable where possible. Keep `CanvasRuntime` and `CanvasSurface` objects in runtime modules, refs, or lifecycle owners, not persisted document/framework state.

## Editing Existing Prism Apps

Read actual files before editing.

Do not guess:

- Prism import paths
- runtime setup
- surface ownership
- export flow
- native gate behavior
- coordinate-space assumptions

When editing, preserve:

- app/runtime ownership boundary
- existing cleanup path
- existing source surface DOM
- existing export readiness sequence

Only change what was requested.

## Common Failure Modes

Surface does not appear: check that the source DOM node exists, is registered through `runtime.registerSurface()`, and `drawSurface(surface)` is called inside `onPaint()`. Also ensure the runtime is started or `paintOnce()` is awaited.

Export is empty or stale: use the required sequence: assets loaded/decoded -> `document.fonts.ready` -> `runtime.paintOnce()` -> `canvas.toBlob()`.

Native backend expected but fallback selected: the browser does not expose native HTML-in-Canvas. Use Chromium/Chrome Canary with `chrome://flags/#canvas-draw-element` enabled, or show the support gate.

Surface alignment is off: surface bounds are CSS pixels. Direct canvas drawing is backing-store pixels. Use `cssPointToCanvasPixels()` and `cssLengthToCanvasPixels()` when aligning manual canvas drawing.

Paint handlers run too many times: `onPaint()` and `onUpdate()` are additive. A handler was likely registered inside a render loop, pointer handler, or React render body. Move registration to stable setup.

## Output Checklist

Before finalizing a Prism integration:

- [ ] Imports use `@synthesisengineering/prism`.
- [ ] App code does not call raw HTML-in-Canvas APIs.
- [ ] DOM source surfaces are real inspectable HTML/CSS/SVG.
- [ ] Surface bounds are CSS pixels.
- [ ] Manual canvas drawing accounts for backing-store pixels.
- [ ] `drawSurface()` is called only inside `onPaint()`.
- [ ] `onPaint()` / `onUpdate()` are registered once during setup.
- [ ] Export waits for `document.fonts.ready` and `runtime.paintOnce()`.
- [ ] Runtime cleanup calls `surface.dispose()` / `runtime.destroy()`.
- [ ] Native support gate appears when native fidelity is required.
- [ ] No `html2canvas`, `dom-to-image`, iframe capture, or `foreignObject` export.

## Example Roles

- Pie Chart: minimal Canvas 2D surface/coordinate example.
- Prism Atlantic: real data visualization with Prism-managed HTML/CSS surfaces.
- React Composer Lite: React-authored components as transformable/exportable surfaces.
- Prism Atelier: DOM-authored HTML/CSS/SVG as creative canvas material.
