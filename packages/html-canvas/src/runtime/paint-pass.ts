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
 * current frame. Registered surfaces that are not drawn are deactivated for
 * pointer and focus handling.
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

export function flushPaintPass(options: PaintPassOptions): void {
  const { canvas, ctx, metrics, backend, surfaces, handlers, time, invalidate } = options;
  ctx.reset();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  surfaces.forEachSurface(deactivateSurface);

  const backendFailures = new Set<unknown>();
  const drawSurface = (surface: CanvasSurface): void => {
    surfaces.assertRegistered(surface);
    const cssBounds = surface.getBounds();
    // Bounds are application code and may dispose or transfer this surface.
    surfaces.assertRegistered(surface);
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
    activateSurface(surface);
  };

  for (const handler of handlers) {
    try {
      handler({ ctx, time, drawSurface, invalidate });
    } catch (error) {
      if (backendFailures.has(error)) throw error;
      throw new PaintHandlerError(error);
    }
  }
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
