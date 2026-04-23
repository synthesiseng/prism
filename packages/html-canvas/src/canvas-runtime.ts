import type { FrameTime } from "@prism/core";
import { FrameLoop } from "@prism/core";
import { Rect, type RectLike } from "@prism/math";
import type { RuntimeBackend } from "./backend";
import { FallbackCanvasBackend } from "./backends/fallback-backend";
import { NativeHtmlCanvasBackend } from "./backends/native-backend";
import {
  hasNativeHtmlCanvas,
  type HtmlCanvasContext2D
} from "./experimental-types";
import { observeHiDpiCanvas, type CanvasMetrics } from "./hidpi";
import { CanvasSurface, type SurfaceOptions } from "./surface";

export type UpdateHandler = (time: FrameTime) => void;

export type PaintHandler = (api: {
  ctx: HtmlCanvasContext2D;
  time: FrameTime;
  drawSurface: (surface: CanvasSurface) => void;
  invalidate: () => void;
}) => void;

export type CanvasRuntimeOptions = Readonly<{
  backend?: "auto" | "native" | "fallback";
}>;

export class CanvasRuntime {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: HtmlCanvasContext2D;
  readonly backend: RuntimeBackend;

  private readonly loop: FrameLoop;
  private readonly surfaces: CanvasSurface[] = [];
  private readonly updateHandlers: UpdateHandler[] = [];
  private readonly paintHandlers: PaintHandler[] = [];
  private readonly hiDpiObserver: ResizeObserver;

  private metrics: CanvasMetrics = {
    cssWidth: 0,
    cssHeight: 0,
    pixelWidth: 0,
    pixelHeight: 0,
    pixelRatio: globalThis.devicePixelRatio || 1
  };
  private frameTime: FrameTime = { now: 0, delta: 0, frame: 0 };
  private pendingPaint = true;

  constructor(canvas: HTMLCanvasElement, options: CanvasRuntimeOptions = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Prism CanvasRuntime requires a 2D canvas context.");
    }

    this.ctx = ctx as HtmlCanvasContext2D;
    this.backend = resolveBackend(canvas, ctx, options.backend);
    if (this.backend.kind === "native") {
      this.canvas.setAttribute("layoutsubtree", "");
    }
    this.loop = new FrameLoop();
    this.loop.addSystem({
      update: (time) => {
        this.frameTime = time;
        for (const handler of this.updateHandlers) {
          handler(time);
        }
        this.pendingPaint = true;
      },
      render: () => {
        if (!this.pendingPaint) {
          return;
        }

        if (this.backend.usesNativePaintEvent) {
          this.backend.requestPaint(this.canvas);
        } else {
          this.flushPaint();
        }
      }
    });

    this.hiDpiObserver = observeHiDpiCanvas(canvas, (metrics) => {
      this.metrics = metrics;
      this.pendingPaint = true;
      if (!this.backend.usesNativePaintEvent) {
        return;
      }
      this.backend.requestPaint(this.canvas);
    });

    this.metrics = initializeCanvasMetrics(canvas);

    if (this.backend.usesNativePaintEvent && hasNativeHtmlCanvas(this.canvas, this.ctx)) {
      this.canvas.onpaint = () => {
        this.flushPaint();
      };
    }
  }

  get width(): number {
    return this.metrics.cssWidth;
  }

  get height(): number {
    return this.metrics.cssHeight;
  }

  get pixelRatio(): number {
    return this.metrics.pixelRatio;
  }

  registerSurface(element: HTMLElement, options: SurfaceOptions): CanvasSurface {
    if (element.parentElement !== this.canvas) {
      this.canvas.appendChild(element);
    }

    const surface = new CanvasSurface(element, options);
    surface.element.style.position = "absolute";
    surface.element.style.left = "0";
    surface.element.style.top = "0";
    surface.element.style.transformOrigin = "0 0";
    setSurfaceInteractivity(surface, false);
    this.surfaces.push(surface);
    this.invalidate();
    return surface;
  }

  clientToCanvasPoint(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? this.canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? this.canvas.height / rect.height : 1;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  cssLengthToCanvasPixels(length: number): number {
    return length * this.metrics.pixelRatio;
  }

  onUpdate(handler: UpdateHandler): this {
    this.updateHandlers.push(handler);
    return this;
  }

  onPaint(handler: PaintHandler): this {
    this.paintHandlers.push(handler);
    return this;
  }

  invalidate(): void {
    this.pendingPaint = true;
    if (this.backend.usesNativePaintEvent) {
      this.backend.requestPaint(this.canvas);
    }
  }

  start(): void {
    this.loop.start();
  }

  stop(): void {
    this.loop.stop();
  }

  destroy(): void {
    this.stop();
    this.hiDpiObserver.disconnect();
    if (this.backend.usesNativePaintEvent && hasNativeHtmlCanvas(this.canvas, this.ctx)) {
      this.canvas.onpaint = null;
    }
  }

  private flushPaint(): void {
    this.pendingPaint = false;
    this.ctx.reset();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const surface of this.surfaces) {
      setSurfaceInteractivity(surface, false);
    }

    const drawSurface = (surface: CanvasSurface): void => {
      assertRegisteredSurface(this.surfaces, surface);
      const cssBounds = surface.getBounds();
      const pixelBounds = this.cssRectToCanvasRect(cssBounds);
      this.backend.render(
        { ctx: this.ctx, time: this.frameTime },
        [{ surface, cssBounds, pixelBounds }],
        (targetSurface, transform, targetBounds) => {
          syncSurfaceElement(targetSurface, transform, targetBounds);
        }
      );
    };

    for (const handler of this.paintHandlers) {
      handler({
        ctx: this.ctx,
        time: this.frameTime,
        drawSurface,
        invalidate: () => this.invalidate()
      });
    }
  }

  private cssRectToCanvasRect(bounds: RectLike): Rect {
    const scaleX = this.width > 0 ? this.canvas.width / this.width : 1;
    const scaleY = this.height > 0 ? this.canvas.height / this.height : 1;
    return new Rect(
      bounds.x * scaleX,
      bounds.y * scaleY,
      bounds.width * scaleX,
      bounds.height * scaleY
    );
  }
}

function resolveBackend(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  input: CanvasRuntimeOptions["backend"]
): RuntimeBackend {
  if (!input || input === "auto" || input === "native") {
    const nativeBackend = new NativeHtmlCanvasBackend();
    if (nativeBackend.isSupported(canvas, context)) {
      return nativeBackend;
    }
    if (input === "native") {
      throw new Error("Native HTML-in-Canvas is not available in this browser.");
    }
  }

  return new FallbackCanvasBackend();
}

function syncSurfaceElement(surface: CanvasSurface, transform: DOMMatrix, bounds: Rect): void {
  surface.element.style.width = `${String(bounds.width)}px`;
  surface.element.style.height = `${String(bounds.height)}px`;
  surface.element.style.transform = transform.toString();
  setSurfaceInteractivity(surface, true);
}

function setSurfaceInteractivity(surface: CanvasSurface, active: boolean): void {
  surface.element.style.pointerEvents = active ? "auto" : "none";
  const inertElement = surface.element as HTMLElement & { inert?: boolean };
  if ("inert" in inertElement) {
    inertElement.inert = !active;
  }
}

function assertRegisteredSurface(
  surfaces: readonly CanvasSurface[],
  surface: CanvasSurface
): void {
  if (!surfaces.includes(surface)) {
    throw new Error("Prism CanvasRuntime can only draw surfaces registered with this runtime.");
  }
}

function initializeCanvasMetrics(canvas: HTMLCanvasElement): CanvasMetrics {
  const pixelRatio = globalThis.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth;
  const cssHeight = canvas.clientHeight;
  const pixelWidth = Math.max(1, Math.round(cssWidth * pixelRatio));
  const pixelHeight = Math.max(1, Math.round(cssHeight * pixelRatio));

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  return { cssWidth, cssHeight, pixelWidth, pixelHeight, pixelRatio };
}
