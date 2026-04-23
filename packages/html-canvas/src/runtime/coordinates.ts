import { Rect, type RectLike } from "@prism/math";
import type { CanvasMetrics } from "../hidpi";

/**
 * A point in the runtime's coordinate space.
 *
 * @remarks
 * Public runtime coordinates use CSS pixels. Use the CSS-to-canvas helpers when
 * you need backing-store pixels for direct canvas drawing.
 */
export type CanvasPoint = Readonly<{
  /**
   * X coordinate.
   */
  x: number;

  /**
   * Y coordinate.
   */
  y: number;
}>;

export function clientToCanvasPoint(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number
): CanvasPoint {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  };
}

export function cssLengthToCanvasPixels(
  metrics: CanvasMetrics,
  length: number
): number {
  return length * metrics.pixelRatio;
}

export function cssPointToCanvasPixels(
  canvas: HTMLCanvasElement,
  metrics: CanvasMetrics,
  point: CanvasPoint
): CanvasPoint {
  const scaleX = metrics.cssWidth > 0 ? canvas.width / metrics.cssWidth : metrics.pixelRatio;
  const scaleY = metrics.cssHeight > 0 ? canvas.height / metrics.cssHeight : metrics.pixelRatio;
  return {
    x: point.x * scaleX,
    y: point.y * scaleY
  };
}

export function cssRectToCanvasPixels(
  canvas: HTMLCanvasElement,
  metrics: CanvasMetrics,
  bounds: RectLike
): Rect {
  const scaleX = metrics.cssWidth > 0 ? canvas.width / metrics.cssWidth : 1;
  const scaleY = metrics.cssHeight > 0 ? canvas.height / metrics.cssHeight : 1;
  return new Rect(
    bounds.x * scaleX,
    bounds.y * scaleY,
    bounds.width * scaleX,
    bounds.height * scaleY
  );
}
