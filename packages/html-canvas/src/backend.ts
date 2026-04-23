import type { FrameTime } from "@prism/core";
import type { Rect } from "@prism/math";
import type { CanvasSurface } from "./surface";
import type { HtmlCanvasContext2D } from "./experimental-types";

export type SurfaceDrawRequest = Readonly<{
  surface: CanvasSurface;
  cssBounds: Rect;
  pixelBounds: Rect;
}>;

export type PaintFrame = Readonly<{
  ctx: HtmlCanvasContext2D;
  time: FrameTime;
}>;

export interface RuntimeBackend {
  readonly kind: "native" | "fallback";
  readonly usesNativePaintEvent: boolean;
  isSupported(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D): boolean;
  requestPaint(canvas: HTMLCanvasElement): void;
  render(
    frame: PaintFrame,
    draws: readonly SurfaceDrawRequest[],
    syncTransform: (surface: CanvasSurface, transform: DOMMatrix, bounds: Rect) => void
  ): void;
}
