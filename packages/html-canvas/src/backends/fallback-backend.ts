import type { Rect } from "@prism/math";
import type { RuntimeBackend, SurfaceDrawRequest } from "../backend";
import type { HtmlCanvasContext2D } from "../experimental-types";
import type { CanvasSurface } from "../surface";

export class FallbackCanvasBackend implements RuntimeBackend {
  readonly kind = "fallback" as const;
  readonly usesNativePaintEvent = false;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  constructor(createCanvas: () => HTMLCanvasElement = createFallbackCanvas) {
    this.canvas = createCanvas();
    const ctx = this.canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Could not create fallback canvas backend context.");
    }

    this.ctx = ctx;
  }

  isSupported(): boolean {
    return true;
  }

  requestPaint(): void {
    // Fallback renders are driven directly by the runtime's RAF tick.
  }

  render(
    frame: Readonly<{ ctx: HtmlCanvasContext2D }>,
    draws: readonly SurfaceDrawRequest[],
    syncTransform: (surface: CanvasSurface, transform: DOMMatrix, bounds: Rect) => void
  ): void {
    for (const draw of draws) {
      const source = this.captureSurface(draw.surface, draw.cssBounds, draw.pixelBounds);
      frame.ctx.drawImage(
        source,
        draw.pixelBounds.x,
        draw.pixelBounds.y,
        draw.pixelBounds.width,
        draw.pixelBounds.height
      );

      const transform = new DOMMatrix().translateSelf(draw.cssBounds.x, draw.cssBounds.y);

      syncTransform(draw.surface, transform, draw.cssBounds);
    }
  }

  private captureSurface(
    surface: CanvasSurface,
    cssBounds: Rect,
    pixelBounds: Rect
  ): HTMLCanvasElement {
    const width = Math.max(1, Math.round(pixelBounds.width));
    const height = Math.max(1, Math.round(pixelBounds.height));

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    this.ctx.reset();
    this.ctx.scale(width / Math.max(cssBounds.width, 1), height / Math.max(cssBounds.height, 1));
    this.ctx.fillStyle = "#101826";
    this.ctx.fillRect(0, 0, cssBounds.width, cssBounds.height);
    this.ctx.strokeStyle = "#5eead4";
    this.ctx.lineWidth = 1.5;
    this.ctx.strokeRect(0.75, 0.75, cssBounds.width - 1.5, cssBounds.height - 1.5);
    this.ctx.fillStyle = "#ecfeff";
    this.ctx.font = "600 15px system-ui";
    this.ctx.fillText(
      surface.element.dataset.prismSurfaceTitle ?? surface.element.tagName,
      16,
      28
    );

    return this.canvas;
  }
}

function createFallbackCanvas(): HTMLCanvasElement {
  return document.createElement("canvas");
}
