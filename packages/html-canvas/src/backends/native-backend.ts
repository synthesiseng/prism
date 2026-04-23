import type { Rect } from "@prism/math";
import type { RuntimeBackend, SurfaceDrawRequest } from "../backend";
import { hasNativeHtmlCanvas, type HtmlCanvasContext2D, type HtmlCanvasElement } from "../experimental-types";
import type { CanvasSurface } from "../surface";

export class NativeHtmlCanvasBackend implements RuntimeBackend {
  readonly kind = "native" as const;
  readonly usesNativePaintEvent = true;

  isSupported(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D): boolean {
    return hasNativeHtmlCanvas(canvas, context);
  }

  requestPaint(canvas: HTMLCanvasElement): void {
    (canvas as HtmlCanvasElement).requestPaint();
  }

  render(
    frame: Readonly<{ ctx: HtmlCanvasContext2D }>,
    draws: readonly SurfaceDrawRequest[],
    syncTransform: (surface: CanvasSurface, transform: DOMMatrix, bounds: Rect) => void
  ): void {
    for (const draw of draws) {
      const transform = frame.ctx.drawElementImage(
        draw.surface.element,
        draw.pixelBounds.x,
        draw.pixelBounds.y,
        draw.pixelBounds.width,
        draw.pixelBounds.height
      );
      syncTransform(draw.surface, transform, draw.cssBounds);
    }
  }
}
