import type { RuntimeBackend, SurfaceDrawRequest } from "../backend";
import { hasNativeHtmlCanvas, type HtmlCanvasContext2D } from "../experimental-types";
import { PrismNativeError } from "../native-error";
import { nativePlatform } from "../runtime/native-platform";

export class NativeHtmlCanvasBackend implements RuntimeBackend {
  readonly kind = "native" as const;
  readonly usesNativePaintEvent = true;

  isSupported(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D): boolean {
    return hasNativeHtmlCanvas(canvas, context);
  }

  requestPaint(canvas: HTMLCanvasElement): void {
    nativePlatform.requestPaint(canvas);
  }

  render(
    frame: Readonly<{ ctx: HtmlCanvasContext2D }>,
    draws: readonly SurfaceDrawRequest[]
  ): void {
    for (const draw of draws) {
      try {
        nativePlatform.draw(frame.ctx, draw.surface.element, draw.pixelBounds);
      } catch (cause) {
        throw new PrismNativeError(
          "draw-failed",
          "Native HTML-in-Canvas drawing failed.",
          { cause }
        );
      }
    }
  }
}
