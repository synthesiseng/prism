<h1 align="center">Prism</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@synthesisengineering/prism">
    <img src="https://img.shields.io/npm/v/@synthesisengineering/prism?style=flat-square" alt="npm version" />
  </a>
  <a href="https://www.npmjs.com/package/@synthesisengineering/prism">
    <img src="https://img.shields.io/npm/dm/@synthesisengineering/prism?style=flat-square" alt="npm downloads" />
  </a>
  <img src="https://img.shields.io/node/v/@synthesisengineering/prism?style=flat-square" alt="node version" />
  <a href="https://github.com/synthesiseng/prism/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/synthesiseng/prism/ci.yml?branch=main&style=flat-square" alt="CI status" />
  </a>
  <a href="https://github.com/synthesiseng/prism/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/synthesiseng/prism?style=flat-square" alt="license" />
  </a>
</p>

Native-first HTML-in-Canvas runtime for managed DOM surfaces in canvas applications.

## What Prism is

Prism is not a canvas engine, UI kit, design tool, app framework, game engine, or charting library.

Author visual surfaces with HTML/CSS/SVG, compose them inside Canvas 2D workflows, and let Prism manage surface registration, bounds, paint lifecycle, invalidation, readiness, coordinate helpers, and cleanup.

Your app still owns the scene, drawing model, animation loop, app state, chart logic, game logic, templates, transforms, and interaction rules.

Prism owns the lifecycle for DOM-authored canvas surfaces.

## Installation

```sh
npm i @synthesisengineering/prism
```

## Quickstart

```ts
import { CanvasRuntime } from "@synthesisengineering/prism";

const runtime = new CanvasRuntime(canvas, { backend: "auto" });

const surface = runtime.registerSurface(element, {
  bounds: { x: 0, y: 0, width: 1200, height: 630 }
});

runtime.onPaint(({ drawSurface }) => {
  drawSurface(surface);
});

runtime.start();
```

## Export Readiness

Use `paintOnce()` when code needs to wait for Prism to complete one runtime-owned paint pass. It works without starting the runtime loop.

```ts
await document.fonts.ready;
await runtime.paintOnce();

const blob = await new Promise<Blob | null>((resolve) => {
  canvas.toBlob(resolve, "image/png");
});
```

Export still uses normal canvas APIs after readiness. If a surface depends on images, make sure they are loaded or decoded before calling `paintOnce()`.

## Backend Modes

Prism prefers native HTML-in-Canvas when available and falls back to a lower-fidelity compatibility backend when it is not.

```ts
if (runtime.backendKind !== "native") {
  console.warn("Compatibility mode is lower fidelity.");
}
```

The fallback backend is compatibility-only. It does not define the public API and is not equivalent to native HTML rendering.

## Coordinate Spaces

Surface bounds and input coordinates use CSS pixels.

Direct drawing inside `onPaint()` uses the canvas backing-store pixel space.

Use runtime helpers when aligning manual canvas drawing with surface coordinates:

- `clientToCanvasPoint()`
- `cssLengthToCanvasPixels()`
- `cssPointToCanvasPixels()`

```ts
runtime.onPaint(({ ctx, drawSurface }) => {
  drawSurface(surface);

  const size = runtime.cssLengthToCanvasPixels(24);
  ctx.fillRect(0, 0, size, size);
});
```

## Surface Lifecycle

Register surfaces through the runtime:

```ts
const surface = runtime.registerSurface(element, {
  bounds: { x: 0, y: 0, width: 320, height: 180 }
});
```

Update surface bounds in CSS pixels:

```ts
surface.setBounds({ x: 24, y: 32, width: 360, height: 220 });
```

When a surface leaves the runtime:

```ts
runtime.unregisterSurface(surface);
// or
surface.dispose();
```

Destroy the runtime when finished:

```ts
runtime.destroy();
```

Undrawn surfaces are inactive for pointer and focus handling until they are drawn again.

## API

The supported package entry point is:

```ts
import { CanvasRuntime } from "@synthesisengineering/prism";
import type {
  CanvasBackendKind,
  CanvasBackendPreference,
  CanvasPoint,
  CanvasRuntimeOptions,
  CanvasSurface,
  PaintHandler,
  SurfaceBoundsInput,
  SurfaceOptions,
  UpdateHandler
} from "@synthesisengineering/prism";
```

`CanvasRuntime` is the only constructible public runtime class. `CanvasSurface`
is returned by `registerSurface()` and may be imported as a type, but
applications should not construct surfaces directly.

Everything outside the package root is internal. Runtime internals, backend
classes, and raw HTML-in-Canvas platform wrappers are not public API.

### Settings

```ts
new CanvasRuntime(canvas, options);
```

Creates a Prism runtime for one canvas.

Options:

- `backend`: `"auto" | "native" | "fallback"`

### Properties

- `canvas`
- `width`
- `height`
- `pixelRatio`
- `backendKind`

### Methods

- `registerSurface(element, options)`
- `unregisterSurface(surface)`
- `onUpdate(handler)`
- `onPaint(handler)`
- `invalidate()`
- `paintOnce()`
- `start()`
- `stop()`
- `destroy()`
- `clientToCanvasPoint(x, y)`
- `cssLengthToCanvasPixels(length)`
- `cssPointToCanvasPixels(point)`

### CanvasSurface

- `element`
- `isDisposed`
- `getBounds()`
- `setBounds(bounds)`
- `dispose()`

## Considerations

- Native HTML-in-Canvas is currently experimental.
- Fallback is compatibility-only and lower fidelity.
- `paintOnce()` waits for one runtime-owned paint pass; it does not export image data itself.
- Surface bounds and input coordinates are CSS pixels.
- Direct `ctx` drawing uses canvas backing-store pixels.
- Undrawn surfaces are inactive for pointer and focus handling until they are drawn again.

## Limitations

- Native mode depends on browser support for HTML-in-Canvas.
- Fallback is not equivalent to native HTML rendering.
- Prism v1 is 2D-first.
- WebGL/WebGPU and renderer integrations are future-facing, not the current public API center.

## Native Support

Native HTML-in-Canvas currently requires a Chromium build with the
`canvas-draw-element` flag enabled. Chrome Canary is the primary target.

```txt
chrome://flags/#canvas-draw-element
```

## Development

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm lint
pnpm build
```

## Platform Credit

Prism is built around the [HTML-in-Canvas proposal](https://github.com/WICG/html-in-canvas)
and related standards work in the WICG. All credit for the underlying platform
capability goes to the proposal authors and the WICG.

## License

MIT © [Synthesis](https://synthesis.engineering)
