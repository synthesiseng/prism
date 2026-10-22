import { writeSurfaceStyle } from "./dom-writes";
import type { FrameTime } from "@prism/core";
import type { Rect } from "@prism/math";
import type { RuntimeBackend } from "../backend";
import type { HtmlCanvasContext2D } from "../experimental-types";
import type { CanvasMetrics } from "../hidpi";
import type { CanvasSurface } from "../surface";
import { cssRectToCanvasPixels } from "./coordinates";
import { activateSurface, deactivateSurface } from "./surface-activation";
import type { SurfaceRegistry } from "./surface-registry";

/**
 * Handles a paint pass for the runtime.
 *
 * @remarks
 * Paint handlers receive the native 2D canvas context and must call
 * `drawSurface()` for each registered HTML surface that should be active in the
 * current frame. Omitted surfaces are deactivated for pointer and focus handling.
 * Layout-deferred surfaces retain their prior interaction state until the retry
 * completes or fails.
 *
 * @param api - Paint context and surface drawing controls.
 */
export type PaintHandler = (api: {
  ctx: CanvasRenderingContext2D;
  time: FrameTime;
  drawSurface: (surface: CanvasSurface) => void;
  invalidate: () => void;
}) => void;

export type PaintPassOptions = Readonly<{
  canvas: HTMLCanvasElement;
  ctx: HtmlCanvasContext2D;
  metrics: CanvasMetrics;
  backend: RuntimeBackend;
  surfaces: SurfaceRegistry;
  handlers: readonly PaintHandler[];
  time: FrameTime;
  invalidate: () => void;
}>;

/** Internal origin marker; callers receive the original thrown value. */
export class PaintHandlerError extends Error {
  constructor(readonly error: unknown) { super("Application paint handler failed."); }
}

export function flushPaintPass(options: PaintPassOptions): boolean {
  const { canvas, ctx, metrics, backend, surfaces, handlers, time, invalidate } = options;
  ctx.reset();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const native = backend.usesNativePaintEvent;
  const drawn = new Set<CanvasSurface>();
  const deferred = new Set<CanvasSurface>();
  if (!native) surfaces.forEachSurface(deactivateSurface);

  let complete = true;
  const backendFailures = new Set<unknown>();
  const drawSurface = (surface: CanvasSurface): void => {
    surfaces.assertRegistered(surface);
    const cssBounds = surface.getBounds();
    // Bounds are application code and may dispose or transfer this surface.
    surfaces.assertRegistered(surface);
    if (!surfaces.layoutReady(surface, cssBounds)) {
      complete = false;
      deferred.add(surface);
      return;
    }
    const pixelBounds = cssRectToCanvasPixels(canvas, metrics, cssBounds);
    try {
      backend.render(
        { ctx, time },
        [{ surface, cssBounds, pixelBounds }],
        (target, transform, bounds) => {
          surfaces.assertRegistered(target);
          syncSurfaceElement(target, transform, bounds);
        }
      );
    } catch (error) {
      backendFailures.add(error);
      throw error;
    }
    surfaces.assertRegistered(surface);
    // This source now belongs to the completed draw, not the deferred retry.
    surfaces.setLayoutDeferred(surface, false);
    activateSurface(surface);
    drawn.add(surface);
  };

  let failure: { error: unknown } | undefined;
  try {
    for (const handler of handlers) {
      try {
        handler({ ctx, time, drawSurface, invalidate });
      } catch (error) {
        if (backendFailures.has(error)) throw error;
        throw new PaintHandlerError(error);
      }
    }
  } catch (error) {
    failure = { error };
  } finally {
    if (native) {
      // Keep stable active sources unchanged: toggling inert before application
      // layout reads can invalidate the next native snapshot indefinitely.
      surfaces.forEachSurface((surface) => {
        const retainDeferred = !failure && deferred.has(surface) && !drawn.has(surface);
        surfaces.setLayoutDeferred(surface, retainDeferred);
        if (drawn.has(surface) || retainDeferred) return;
        try { deactivateSurface(surface); }
        catch (error) { failure ??= { error }; }
      });
    }
  }
  if (failure) throw failure.error;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- drawSurface can mark the pass incomplete from a handler callback.
  return complete && !surfaces.hasPendingLayout;
}

function syncSurfaceElement(
  surface: CanvasSurface,
  transform: DOMMatrix,
  bounds: Rect
): void {
  if (surface.isDisposed) return;
  writeSurfaceStyle(surface.element, "width", `${String(bounds.width)}px`);
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Style callbacks can dispose the surface synchronously.
  if (surface.isDisposed) return;
  writeSurfaceStyle(surface.element, "height", `${String(bounds.height)}px`);
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Style callbacks can dispose the surface synchronously.
  if (surface.isDisposed) return;
  writeSurfaceStyle(surface.element, "transform", transform.toString());
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Style callbacks can dispose the surface synchronously.
  if (surface.isDisposed) return;
  activateSurface(surface);
}
