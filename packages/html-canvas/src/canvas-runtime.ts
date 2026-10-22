import { PrismNativeError } from "./native-error";
import { nativePlatform } from "./runtime/native-platform";
import { visiblePaintDeadline } from "./runtime/visible-paint-deadline";
import type { FrameTime } from "@prism/core";
import { FrameLoop } from "@prism/core";
import type { RuntimeBackend } from "./backend";
import { nativeCapability, type HtmlCanvasContext2D } from "./experimental-types";
import {
  observeHiDpiCanvas,
  resizeCanvasToDisplaySize,
  type CanvasMetrics
} from "./hidpi";
import type { CanvasSurface, SurfaceOptions } from "./surface";
import { selectRuntimeBackend } from "./runtime/backend-selection";
import {
  clientToCanvasPoint as toCanvasPoint,
  cssLengthToCanvasPixels as toCanvasPixelLength,
  cssPointToCanvasPixels as toCanvasPixelPoint
} from "./runtime/coordinates";
import { flushPaintPass, PaintHandlerError } from "./runtime/paint-pass";
import { SurfaceRegistry } from "./runtime/surface-registry";

/**
 * A point in the runtime's public coordinate space.
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

/**
 * Handles runtime state updates before a paint pass.
 *
 * @param time - Timing data for the current animation frame.
 */
export type UpdateHandler = (time: FrameTime) => void;

/**
 * Handles a runtime-owned paint pass.
 *
 * @remarks
 * Direct drawing with `ctx` uses canvas backing-store pixels. Registered HTML
 * surfaces use CSS-pixel bounds and must be drawn with `drawSurface()`.
 *
 * @param api - Paint context and surface drawing controls.
 */
export type PaintHandler = (api: {
  /**
   * Canvas 2D context for direct drawing in backing-store pixels.
   */
  ctx: CanvasRenderingContext2D;

  /**
   * Timing data for the current frame.
   */
  time: FrameTime;

  /**
   * Draws a registered surface immediately at its current CSS-pixel bounds.
   */
  drawSurface: (surface: CanvasSurface) => void;

  /**
   * Requests another runtime-owned paint pass.
   */
  invalidate: () => void;
}) => void;

/**
 * Identifies the backend selected by the runtime.
 */
export type CanvasBackendKind = "native" | "fallback";

/**
 * Selects how the runtime chooses its backend.
 *
 * @remarks
 * `"auto"` prefers native HTML-in-Canvas and falls back to the compatibility
 * backend when native browser support is unavailable.
 */
export type CanvasBackendPreference = "auto" | CanvasBackendKind;

/**
 * Configures a Prism canvas runtime.
 */
export type CanvasRuntimeOptions = Readonly<{
  /**
   * Chooses the rendering backend.
   */
  backend?: CanvasBackendPreference;
  /** Visible-time diagnostic deadline in milliseconds. Default 2000 is provisional. */
  nativePaintTimeoutMs?: number;
}>;

const canvasOwners = new WeakMap<HTMLCanvasElement, CanvasRuntime>();

/** Read-only snapshot of backend capability and last native paint outcome. */
export type CanvasDiagnostics = Readonly<{
  backend: CanvasBackendKind;
  capability: "supported" | "unavailable" | "unsupported-version";
  health?: "idle" | "pending" | "healthy" | "failed";
  lastError?: PrismNativeError;
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
 * scheduling, native/fallback backend selection, HiDPI sizing, fallback transform
 * sync, invalidation, and coordinate conversion. Surface bounds and client
 * input coordinates are CSS pixels; the runtime converts to backing-store
 * pixels when drawing registered surfaces.
 *
 * Paint handlers receive the real 2D canvas context. Direct drawing with `ctx`
 * uses normal canvas/backing-store pixel coordinates; use the runtime
 * conversion helpers when aligning manual canvas drawing with CSS-space
 * surfaces.
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

  private readonly backend: RuntimeBackend;
  private readonly ctx: HtmlCanvasContext2D;
  private readonly loop!: FrameLoop;
  private readonly surfaces: SurfaceRegistry;
  private readonly updateHandlers: UpdateHandler[] = [];
  private readonly paintHandlers: PaintHandler[] = [];
  private readonly hiDpiObserver: ResizeObserver | undefined;

  private paintWaiters: PaintWaiter[] = [];
  private fallbackPaintScheduled = false;
  private nativePaintRequestedForWaiters = false;
  private releaseNativeCanvas: (() => void) | undefined;
  private removeNativePaintListener: (() => void) | undefined;
  private cancelNativeDeadline: (() => void) | undefined;
  private readonly nativePaintTimeoutMs: number;
  private readonly capability: CanvasDiagnostics["capability"];
  private nativeHealth: NonNullable<CanvasDiagnostics["health"]> = "idle";
  private lastNativeError: PrismNativeError | undefined;
  private activePaintWaiters: readonly PaintWaiter[] = [];
  private readonly paintRequestFailures = new Set<unknown>();
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
    if (canvasOwners.has(canvas)) {
      throw new Error("Prism canvas is already owned by an active runtime.");
    }
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Prism CanvasRuntime requires a 2D canvas context.");
    }

    this.ctx = ctx as HtmlCanvasContext2D;
    this.backend = selectRuntimeBackend(canvas, ctx, options.backend);
    this.capability = nativeCapability(canvas, ctx);
    this.nativePaintTimeoutMs = options.nativePaintTimeoutMs ?? 2000;
    if (
      !Number.isFinite(this.nativePaintTimeoutMs) ||
      this.nativePaintTimeoutMs <= 0 ||
      this.nativePaintTimeoutMs > 2 ** 31 - 1
    ) {
      throw new RangeError(
        "nativePaintTimeoutMs must be greater than 0 and at most 2147483647."
      );
    }
    canvasOwners.set(canvas, this);
    try {
      if (this.backend.kind === "native") {
        this.releaseNativeCanvas = nativePlatform.activateCanvas(canvas);
        this.removeNativePaintListener = nativePlatform.onPaint(canvas, () => {
          if (!this.destroyed) this.flushPaint(false);
        });
      }
      this.surfaces = new SurfaceRegistry(
        canvas,
        () => this.invalidate(),
        () => this.invalidateSurfaceBounds(),
        this.backend.kind === "native"
      );
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
          if (this.destroyed || !this.pendingPaint) {
            return;
          }

          if (this.backend.usesNativePaintEvent) {
            this.requestNativePaintForWaiters();
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
        this.requestNativePaintForWaiters();
      });

      this.metrics = resizeCanvasToDisplaySize(canvas);
    } catch (error) {
      const failures: unknown[] = [error];
      try {
        for (const cleanup of [
          () => this.cancelNativeDeadline?.(),
          () => this.removeNativePaintListener?.(),
          () => this.hiDpiObserver?.disconnect(),
          () => this.releaseNativeCanvas?.()
        ]) {
          try {
            cleanup();
          } catch (cause) {
            failures.push(cause);
          }
        }
      } finally {
        canvasOwners.delete(canvas);
      }
      if (failures.length > 1) {
        throw new AggregateError(failures, "Prism runtime creation and cleanup failed.", { cause: error });
      }
      throw error;
    }
  }

  /** Current capability and native paint health; a snapshot, not a scheduling API. */
  get diagnostics(): CanvasDiagnostics {
    return Object.freeze({
      backend: this.backend.kind,
      capability: this.capability,
      ...(this.backend.kind === "native" ? { health: this.nativeHealth } : {}),
      ...(this.lastNativeError ? { lastError: this.lastNativeError } : {})
    });
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
   * it. Surface bounds are expressed in CSS pixels. Dispose or unregister the
   * returned surface to restore ownership.
   *
   * Registering an element already owned by an active surface throws, including
   * within this runtime. Use `CanvasSurface.setBounds()` to move or resize it.
   *
   * @param element - HTML element represented by the surface.
   * @param options - Initial surface bounds and accessibility options.
   * @returns The registered runtime surface.
   *
   * @throws Error when called after the runtime is destroyed.
   */
  registerSurface(element: HTMLElement, options: SurfaceOptions): CanvasSurface {
    this.assertNotDestroyed("register a surface with");

    return this.surfaces.register(element, options);
  }

  /**
   * Unregisters a surface and restores its original DOM ownership.
   *
   * @param surface - Surface returned by `registerSurface()`.
   *
   * @throws Error when the surface is still active but belongs to another runtime.
   */
  unregisterSurface(surface: CanvasSurface): void {
    if (surface.isDisposed) {
      return;
    }

    this.surfaces.assertRegistered(surface);
    surface.dispose();
  }

  /**
   * Converts viewport client coordinates into runtime CSS-pixel coordinates.
   *
   * @remarks
   * Use this for pointer and mouse input. The returned point is in the same
   * CSS-pixel coordinate space used by registered surface bounds, not the
   * canvas backing-store pixel space used by direct `ctx` drawing.
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
    this.assertNotDestroyed("register an update handler on");
    this.updateHandlers.push(handler);
    return this;
  }

  /**
   * Registers a paint handler.
   *
   * @remarks
   * `drawSurface()` accepts surfaces whose bounds are CSS pixels. Direct drawing
   * through `ctx` uses the canvas backing-store pixel coordinate space.
   *
   * @param handler - Function called when the runtime paints.
   * @returns This runtime for chaining.
   */
  onPaint(handler: PaintHandler): this {
    this.assertNotDestroyed("register a paint handler on");
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
   * after Prism runs the same synchronous paint pass directly. Multiple calls
   * made before a paint completes resolve from that paint pass.
   *
   * Calling `paintOnce()` does not require `start()`. If it is called from
   * inside `onPaint()`, it waits for the next paint pass; it never resolves from
   * the pass that is already in progress and never recursively paints.
   *
   * The method does not export image data; use standard canvas APIs after the
   * promise resolves.
   *
   * @returns A promise that resolves after one runtime-owned paint pass.
   */
  paintOnce(): Promise<void> {
    if (this.destroyed) {
      return Promise.reject(createDestroyedRuntimeError("paint"));
    }

    return new Promise((resolve, reject) => {
      const waiter: PaintWaiter = { resolve, reject };
      this.paintWaiters.push(waiter);

      try {
        this.pendingPaint = true;
        if (this.backend.usesNativePaintEvent) {
          this.requestNativePaintForWaiters();
          return;
        }

        this.scheduleFallbackPaint();
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
      this.requestNativePaintForWaiters();
    }
  }

  /**
   * Starts the runtime frame loop.
   */
  start(): void {
    this.assertNotDestroyed("start");
    this.loop.start();
  }

  /**
   * Stops the runtime frame loop.
   */
  stop(): void {
    if (this.destroyed) {
      return;
    }

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
    const error = new Error(
      "Cannot complete paintOnce() after Prism CanvasRuntime is destroyed."
    );
    this.rejectPaintWaiters(error);
    for (const waiter of this.activePaintWaiters) waiter.reject(error);
    this.activePaintWaiters = [];
    this.fallbackPaintScheduled = false;
    this.nativePaintRequestedForWaiters = false;
    let failure: unknown;
    for (const cleanup of [
      () => this.loop.stop(),
      () => this.cancelNativeDeadline?.(),
      () => this.removeNativePaintListener?.(),
      () => this.hiDpiObserver?.disconnect(),
      () => this.surfaces.clear(),
      () => this.releaseNativeCanvas?.()
    ]) {
      try {
        cleanup();
      } catch (cause) {
        failure ??= cause;
      }
    }
    canvasOwners.delete(this.canvas);
    this.updateHandlers.length = 0;
    this.paintHandlers.length = 0;
    if (failure !== undefined) throw toError(failure);
  }

  private flushPaint(throwOnError = true): void {
    this.paintRequestFailures.clear();
    const waiters = this.paintWaiters;
    this.paintWaiters = [];
    this.activePaintWaiters = waiters;
    this.cancelNativeDeadline?.();
    this.cancelNativeDeadline = undefined;
    this.nativePaintRequestedForWaiters = false;
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
      if (!this.destroyed) {
        for (const waiter of waiters) waiter.resolve();
        this.finishNativePaint("healthy");
        this.lastNativeError = undefined;
      }
    } catch (error) {
      const requestFailure = this.paintRequestFailures.values().next();
      if (error instanceof PaintHandlerError && requestFailure.done) {
        for (const waiter of waiters) waiter.reject(error.error);
        // The native paint arrived; an application bug is not a platform failure.
        if (!this.destroyed) {
          this.finishNativePaint("healthy");
          this.lastNativeError = undefined;
        }
        if (waiters.length === 0) reportError(error.error);
        return;
      }
      // A handler can catch a request failure and then throw a different value.
      // Keep the actual platform failure authoritative for this paint pass.
      const paintError = toError(
        requestFailure.done
          ? error instanceof PaintHandlerError ? error.error : error
          : requestFailure.value
      );
      for (const waiter of waiters) {
        waiter.reject(paintError);
      }
      this.finishNativePaint("failed");
      if (paintError instanceof PrismNativeError) this.lastNativeError = paintError;
      if (throwOnError) {
        throw paintError;
      }
    } finally {
      this.activePaintWaiters = [];
      this.paintRequestFailures.clear();
      this.isPainting = false;
    }
  }

  private finishNativePaint(outcome: "healthy" | "failed"): void {
    // A paint handler may have requested a new pass during this flush.
    this.nativeHealth = this.nativePaintRequestedForWaiters ? "pending" : outcome;
  }

  private requestNativePaintForWaiters(): void {
    if (this.destroyed || this.nativePaintRequestedForWaiters) {
      return;
    }

    this.nativePaintRequestedForWaiters = true;
    this.nativeHealth = "pending";
    this.cancelNativeDeadline = visiblePaintDeadline(
      this.canvas.ownerDocument,
      this.nativePaintTimeoutMs,
      () => {
        this.cancelNativeDeadline = undefined;
        this.nativePaintRequestedForWaiters = false;
        this.nativeHealth = "failed";
        const error = new PrismNativeError(
          "paint-timeout",
          "Native canvas paint exceeded its visible-time diagnostic deadline."
        );
        this.lastNativeError = error;
        this.rejectPaintWaiters(error);
      }
    );
    try {
      this.backend.requestPaint(this.canvas);
    } catch (error) {
      // Request failures can cross an application handler through invalidate().
      if (this.isPainting) this.paintRequestFailures.add(error);
      this.cancelNativeDeadline();
      this.cancelNativeDeadline = undefined;
      this.nativePaintRequestedForWaiters = false;
      this.nativeHealth = "failed";
      this.rejectPaintWaiters(toError(error));
      throw error;
    }
  }

  private invalidateSurfaceBounds(): void {
    if (this.isPainting) {
      return;
    }

    this.invalidate();
  }

  private scheduleFallbackPaint(): void {
    if (this.fallbackPaintScheduled) {
      return;
    }

    this.fallbackPaintScheduled = true;
    queueMicrotask(() => {
      this.fallbackPaintScheduled = false;
      if (this.destroyed || !this.pendingPaint || this.paintWaiters.length === 0) {
        return;
      }

      this.flushPaint(false);
    });
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

  private assertNotDestroyed(operation: string): void {
    if (this.destroyed) {
      throw createDestroyedRuntimeError(operation);
    }
  }
}

function createDestroyedRuntimeError(operation: string): Error {
  return new Error(
    `Cannot ${operation} a destroyed CanvasRuntime. Create a new CanvasRuntime instead.`
  );
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
