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

export function flushPaintPass(options: PaintPassOptions): void {
  const { canvas, ctx, metrics, backend, surfaces, handlers, time, invalidate } = options;
  ctx.reset();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  surfaces.forEachSurface(deactivateSurface);

  const drawSurface = (surface: CanvasSurface): void => {
    surfaces.assertRegistered(surface);
    const cssBounds = surface.getBounds();
    const pixelBounds = cssRectToCanvasPixels(canvas, metrics, cssBounds);
    backend.render(
      { ctx, time },
      [{ surface, cssBounds, pixelBounds }],
      syncSurfaceElement
    );
  };

  for (const handler of handlers) {
    handler({
      ctx,
      time,
      drawSurface,
      invalidate
    });
  }
}

function syncSurfaceElement(
  surface: CanvasSurface,
  transform: DOMMatrix,
  bounds: Rect
): void {
  surface.element.style.width = `${String(bounds.width)}px`;
  surface.element.style.height = `${String(bounds.height)}px`;
  surface.element.style.transform = transform.toString();
  activateSurface(surface);
}
