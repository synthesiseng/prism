# Prism

Prism is a browser canvas runtime focused on one differentiator: HTML/CSS UI is treated as a first-class canvas surface while the accessible DOM remains available for interaction, focus, and assistive technology.

Prism prefers native HTML-in-Canvas browser capabilities when available, and falls back to a deterministic compatibility backend when they are not. The fallback path is intentionally lower fidelity and compatibility-only; it must not shape the main runtime API.

## Workspace

```txt
packages/
  assets/             Asset cache and browser asset loading.
  core/               Frame loop, engine composition, runtime contracts.
  html-canvas/        Prism v1 center: canvas runtime, surfaces, native/fallback backends.
  input/              Browser input adapter.
  math/               Platform-free value math.
  renderer/           WebGL bootstrap and draw primitives.
  scene/              Lightweight scene/entity composition.
  shader-fx/          Effect descriptors and future shader helpers.
  ui-dom/             Legacy private package. Quarantined from the v1 runtime path.
```

## Dependency Rules

Dependencies flow toward stable, lower-level packages:

```txt
math
core -> math
input -> math
html-canvas -> core, math
scene -> core, math
renderer -> core, math
shader-fx -> renderer
```

Rules:

- `math` has no browser dependencies.
- `core` owns runtime lifecycle and timing, not rendering or DOM APIs.
- `html-canvas` owns the Prism v1 runtime: canvas lifecycle, surface registration, native HTML-in-Canvas integration, invalidation, and transform sync.
- `renderer` remains for future WebGL/WebGPU integration and older demos.
- `ui-dom` is legacy, private, and not part of the root build or v1 runtime path.
- Apps compose systems. Engine packages do not import from apps.
- Browser APIs live at subsystem edges rather than leaking through every package.

## Subsystem Responsibilities

### `@prism/core`

Provides `Engine`, `FrameLoop`, `FrameTime`, and `EngineSystem`. Systems can implement `start`, `stop`, `update`, and `render`. This is intentionally small so hot paths stay direct.

### `@prism/math`

Small immutable math values such as `Vec2` and `Rect`. Keep this package platform-free and dependency-free.

### `@prism/html-canvas`

Owns `CanvasRuntime`, `CanvasSurface`, and the native-first backend model. Surface bounds and input coordinates are CSS pixels; the runtime owns backing-store conversion, HiDPI sizing, backend selection, `onpaint` / `requestPaint()` integration, invalidation, lifecycle cleanup, and DOM transform sync.

### `@prism/renderer`

Owns the existing WebGL renderer and remains relevant for future Prism integration, but it is not the v1 center.

### `@prism/input`

Normalizes keyboard and pointer state from a browser element. Input is a runtime subsystem, not a global singleton.

### `@prism/scene`

Provides minimal scene/entity composition. It is not an ECS. Add ECS-style data layout only when profiling or engine features justify it.

### `@prism/assets`

Small asset cache and browser loaders. Keep loading separate from rendering so resource lifetime stays visible.

### `@prism/shader-fx`

Effect descriptors live here while actual GPU implementation remains in renderer-specific code.

## Adding Engine Features

Add features where ownership is clearest:

- New HTML-in-Canvas runtime behavior: `packages/html-canvas`.
- New WebGL draw path: `packages/renderer`.
- New input device: `packages/input`.
- New math primitive: `packages/math`.
- New runtime scheduling behavior: `packages/core`.

Prefer composition through small objects over inheritance trees. For example, a game can compose `CanvasRuntime`, `InputSystem`, and local gameplay systems without each subsystem knowing about the others.

## Runtime API

```ts
import { CanvasRuntime } from "@prism/html-canvas";

const runtime = new CanvasRuntime(canvas, { backend: "auto" });

const surface = runtime.registerSurface(element, {
  bounds: { x: 0, y: 0, width: 800, height: 600 }
});

runtime.onUpdate((time) => {
  void time;
});

runtime.onPaint(({ ctx, drawSurface }) => {
  drawSurface(surface);
  void ctx;
});

runtime.start();
```

Call `surface.dispose()` or `runtime.unregisterSurface(surface)` when a surface leaves the runtime. Undrawn surfaces are inactive for pointer/focus handling until they are drawn again.

## Avoiding Boundary Drift

- Do not import app code from packages.
- Do not put browser APIs into `math` or core data types.
- Do not create a generic `utils` package. If a helper does not have clear ownership, keep it local.
- Do not create service/repository/controller layers. This is an engine runtime, not a CRUD backend.
- Avoid `any`. If browser experiments are not typed, define small local interfaces at the boundary.
- Avoid abstraction in hot paths unless it removes measurable complexity.

## Commands

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm lint
pnpm build
```

## Demo

No first-party demo is currently part of the root workspace. The v1 runtime package is the product center.
