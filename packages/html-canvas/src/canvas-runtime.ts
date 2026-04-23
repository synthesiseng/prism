import type { FrameTime } from "@prism/core";
import { FrameLoop } from "@prism/core";
import type { RuntimeBackend } from "./backend";
import {
  hasNativeHtmlCanvas,
  type HtmlCanvasContext2D
} from "./experimental-types";
import {
  observeHiDpiCanvas,
  resizeCanvasToDisplaySize,
  type CanvasMetrics
} from "./hidpi";
import type { CanvasSurface, SurfaceOptions } from "./surface";
import {
  selectRuntimeBackend,
  type RuntimeBackendKind,
  type RuntimeBackendPreference
} from "./runtime/backend-selection";
import {
  clientToCanvasPoint as toCanvasPoint,
  cssLengthToCanvasPixels as toCanvasPixelLength,
  cssPointToCanvasPixels as toCanvasPixelPoint,
  type CanvasPoint
} from "./runtime/coordinates";
import { flushPaintPass, type PaintHandler } from "./runtime/paint-pass";
import { SurfaceRegistry } from "./runtime/surface-registry";

/**
 * Handles runtime state updates before a paint pass.
 *
 * @param time - Timing data for the current animation frame.
 */
export type UpdateHandler = (time: FrameTime) => void;

export type { CanvasPoint, PaintHandler };

/**
 * Identifies the backend selected by the runtime.
 */
export type CanvasBackendKind = RuntimeBackendKind;

/**
 * Selects how the runtime chooses its backend.
 *
 * @remarks
 * `"auto"` prefers native HTML-in-Canvas and falls back to the compatibility
 * backend when native browser support is unavailable.
 */
export type CanvasBackendPreference = RuntimeBackendPreference;

/**
 * Configures a Prism canvas runtime.
 */
export type CanvasRuntimeOptions = Readonly<{
  /**
   * Chooses the rendering backend.
   */
  backend?: CanvasBackendPreference;
}>;

type PaintWaiter = Readonly<{
  resolve(): void;
  reject(error: unknown): void;
}>;

/**
 * Owns a 2D HTML-in-Canvas runtime for one canvas.
 *
 * @remarks
 * `CanvasRuntime` is the public owner of surface registration, paint
 * scheduling, native/fallback backend selection, HiDPI sizing, DOM transform
 * sync, invalidation, and coordinate conversion. Surface bounds and client
 * input coordinates are CSS pixels; the runtime converts to backing-store
 * pixels when drawing.
 *
 * Native HTML-in-Canvas is preferred when available. The fallback backend is a
 * lower-fidelity compatibility path and should not shape application code.
 *
 * @example
 * ```ts
 * const runtime = new CanvasRuntime(canvas, { backend: "auto" });
 * const surface = runtime.registerSurface(panel, {
 *   bounds: { x: 0, y: 0, width: 320, height: 180 }
 * });
 *
 * runtime.onPaint(({ drawSurface }) => {
 *   drawSurface(surface);
 * });
 *
 * runtime.start();
 * ```
 */
export class CanvasRuntime {
  /**
   * The canvas controlled by this runtime.
   */
  readonly canvas: HTMLCanvasElement;

  /**
   * The 2D context used for runtime painting.
   */
  readonly ctx: HtmlCanvasContext2D;

  private readonly backend: RuntimeBackend;
  private readonly loop: FrameLoop;
  private readonly surfaces: SurfaceRegistry;
  private readonly updateHandlers: UpdateHandler[] = [];
  private readonly paintHandlers: PaintHandler[] = [];
  private readonly hiDpiObserver: ResizeObserver;

  private paintWaiters: PaintWaiter[] = [];
  private metrics: CanvasMetrics = {
    cssWidth: 0,
    cssHeight: 0,
    pixelWidth: 0,
    pixelHeight: 0,
    pixelRatio: globalThis.devicePixelRatio || 1
  };
  private frameTime: FrameTime = { now: 0, delta: 0, frame: 0 };
  private pendingPaint = true;
  private isPainting = false;
  private destroyed = false;

  /**
   * Creates a runtime for a canvas element.
   *
   * @param canvas - Canvas element controlled by the runtime.
   * @param options - Runtime configuration.
   *
   * @throws Error when the canvas cannot create a 2D rendering context.
   * @throws Error when `backend` is `"native"` and native HTML-in-Canvas is unavailable.
   */
  constructor(canvas: HTMLCanvasElement, options: CanvasRuntimeOptions = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Prism CanvasRuntime requires a 2D canvas context.");
    }

    this.ctx = ctx as HtmlCanvasContext2D;
    this.backend = selectRuntimeBackend(canvas, ctx, options.backend);
    if (this.backend.kind === "native") {
      this.canvas.setAttribute("layoutsubtree", "");
    }
    this.surfaces = new SurfaceRegistry(canvas, () => this.invalidate());
    this.loop = new FrameLoop();
    this.loop.addSystem({
      update: (time) => {
        this.frameTime = time;
        for (const handler of this.updateHandlers) {
          handler(time);
        }
        if (this.updateHandlers.length > 0) {
          this.pendingPaint = true;
        }
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

    this.metrics = resizeCanvasToDisplaySize(canvas);

    if (this.backend.usesNativePaintEvent && hasNativeHtmlCanvas(this.canvas, this.ctx)) {
      this.canvas.onpaint = () => {
        this.flushPaint();
      };
    }
  }

  /**
   * Canvas width in CSS pixels.
   */
  get width(): number {
    return this.metrics.cssWidth;
  }

  /**
   * Canvas height in CSS pixels.
   */
  get height(): number {
    return this.metrics.cssHeight;
  }

  /**
   * Current CSS-pixel to backing-store pixel ratio.
   */
  get pixelRatio(): number {
    return this.metrics.pixelRatio;
  }

  /**
   * Backend currently selected by the runtime.
   */
  get backendKind(): CanvasBackendKind {
    return this.backend.kind;
  }

  /**
   * Registers an HTML element as a runtime-managed canvas surface.
   *
   * @remarks
   * Prism stores the element's original DOM owner and selected attributes, then
   * moves the element under the runtime canvas so native HTML-in-Canvas can draw
   * it. Dispose or unregister the returned surface to restore ownership.
   *
   * @param element - HTML element represented by the surface.
   * @param options - Surface bounds and accessibility options.
   * @returns The registered runtime surface.
   *
   * @throws Error when called after the runtime is destroyed.
   */
  registerSurface(element: HTMLElement, options: SurfaceOptions): CanvasSurface {
    if (this.destroyed) {
      throw new Error("Cannot register a surface on a destroyed Prism CanvasRuntime.");
    }

    return this.surfaces.register(element, options);
  }

  /**
   * Unregisters a surface and restores its original DOM ownership.
   *
   * @param surface - Surface returned by `registerSurface()`.
   */
  unregisterSurface(surface: CanvasSurface): void {
    surface.dispose();
  }

  /**
   * Converts viewport client coordinates into runtime CSS-pixel coordinates.
   *
   * @param clientX - Pointer or mouse X coordinate from a DOM event.
   * @param clientY - Pointer or mouse Y coordinate from a DOM event.
   * @returns A point relative to the runtime canvas in CSS pixels.
   */
  clientToCanvasPoint(clientX: number, clientY: number): CanvasPoint {
    return toCanvasPoint(this.canvas, clientX, clientY);
  }

  /**
   * Converts a CSS-pixel length to backing-store pixels.
   *
   * @param length - Length in CSS pixels.
   * @returns The equivalent backing-store pixel length.
   */
  cssLengthToCanvasPixels(length: number): number {
    return toCanvasPixelLength(this.metrics, length);
  }

  /**
   * Converts a CSS-pixel point to backing-store pixels.
   *
   * @param point - Point in runtime CSS-pixel coordinates.
   * @returns The equivalent point in backing-store pixels.
   */
  cssPointToCanvasPixels(point: CanvasPoint): CanvasPoint {
    return toCanvasPixelPoint(this.canvas, this.metrics, point);
  }

  /**
   * Registers an update handler.
   *
   * @param handler - Function called once per animation frame before painting.
   * @returns This runtime for chaining.
   */
  onUpdate(handler: UpdateHandler): this {
    this.updateHandlers.push(handler);
    return this;
  }

  /**
   * Registers a paint handler.
   *
   * @param handler - Function called when the runtime paints.
   * @returns This runtime for chaining.
   */
  onPaint(handler: PaintHandler): this {
    this.paintHandlers.push(handler);
    this.invalidate();
    return this;
  }

  /**
   * Requests one paint pass and resolves after the runtime finishes painting it.
   *
   * @remarks
   * Native runtimes resolve after the browser delivers the canvas paint event
   * and Prism flushes the registered paint handlers. Fallback runtimes resolve
   * after Prism runs the same paint pass directly. The method does not export
   * image data; use standard canvas APIs after the promise resolves.
   *
   * @returns A promise that resolves after one runtime-owned paint pass.
   */
  paintOnce(): Promise<void> {
    if (this.destroyed) {
      return Promise.reject(
        new Error("Cannot paint a destroyed Prism CanvasRuntime.")
      );
    }

    return new Promise((resolve, reject) => {
      const waiter: PaintWaiter = { resolve, reject };
      this.paintWaiters.push(waiter);

      try {
        this.pendingPaint = true;
        if (this.backend.usesNativePaintEvent) {
          this.backend.requestPaint(this.canvas);
          return;
        }

        if (!this.isPainting) {
          this.flushPaint(false);
        }
      } catch (error) {
        this.removePaintWaiter(waiter);
        reject(toError(error));
      }
    });
  }

  /**
   * Schedules a paint pass.
   *
   * @remarks
   * Native runtimes forward invalidation to `requestPaint()`. Fallback runtimes
   * paint on the next runtime frame.
   */
  invalidate(): void {
    if (this.destroyed) {
      return;
    }

    this.pendingPaint = true;
    if (this.backend.usesNativePaintEvent) {
      this.backend.requestPaint(this.canvas);
    }
  }

  /**
   * Starts the runtime frame loop.
   */
  start(): void {
    this.loop.start();
  }

  /**
   * Stops the runtime frame loop.
   */
  stop(): void {
    this.loop.stop();
  }

  /**
   * Stops the runtime and releases runtime-owned DOM state.
   *
   * @remarks
   * Destroying a runtime unregisters all surfaces, disconnects HiDPI observers,
   * and clears native paint hooks. Calling `destroy()` more than once is safe.
   */
  destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.stop();
    this.hiDpiObserver.disconnect();
    if (this.backend.usesNativePaintEvent && hasNativeHtmlCanvas(this.canvas, this.ctx)) {
      this.canvas.onpaint = null;
    }
    this.rejectPaintWaiters(
      new Error("Cannot complete paintOnce() after Prism CanvasRuntime is destroyed.")
    );
    this.surfaces.clear();
    this.updateHandlers.length = 0;
    this.paintHandlers.length = 0;
  }

  private flushPaint(throwOnError = true): void {
    const waiters = this.paintWaiters;
    this.paintWaiters = [];
    this.pendingPaint = false;
    this.isPainting = true;

    try {
      flushPaintPass({
        canvas: this.canvas,
        ctx: this.ctx,
        metrics: this.metrics,
        backend: this.backend,
        surfaces: this.surfaces,
        handlers: this.paintHandlers,
        time: this.frameTime,
        invalidate: () => this.invalidate()
      });
      for (const waiter of waiters) {
        waiter.resolve();
      }
    } catch (error) {
      const paintError = toError(error);
      for (const waiter of waiters) {
        waiter.reject(paintError);
      }
      if (throwOnError) {
        throw paintError;
      }
    } finally {
      this.isPainting = false;
    }
  }

  private removePaintWaiter(waiter: PaintWaiter): void {
    const index = this.paintWaiters.indexOf(waiter);
    if (index !== -1) {
      this.paintWaiters.splice(index, 1);
    }
  }

  private rejectPaintWaiters(error: Error): void {
    const waiters = this.paintWaiters;
    this.paintWaiters = [];
    for (const waiter of waiters) {
      waiter.reject(error);
    }
  }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
