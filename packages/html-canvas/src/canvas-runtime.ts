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
import {
  observeHiDpiCanvas,
  resizeCanvasToDisplaySize,
  type CanvasMetrics
} from "./hidpi";
import { CanvasSurface, setSurfaceLifecycle, type SurfaceOptions } from "./surface";

/**
 * Handles runtime state updates before a paint pass.
 *
 * @param time - Timing data for the current animation frame.
 */
export type UpdateHandler = (time: FrameTime) => void;

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
  ctx: HtmlCanvasContext2D;
  time: FrameTime;
  drawSurface: (surface: CanvasSurface) => void;
  invalidate: () => void;
}) => void;

/**
 * Identifies the backend selected by the runtime.
 */
export type CanvasBackendKind = RuntimeBackend["kind"];

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
}>;

type SurfaceDomState = Readonly<{
  parent: Node | null;
  nextSibling: Node | null;
  style: string | null;
  ariaLabel: string | null;
  prismSurface: string | null;
  inert: boolean | undefined;
}>;

type SurfaceRecord = {
  readonly surface: CanvasSurface;
  readonly domState: SurfaceDomState;
};

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
  private readonly surfaces: SurfaceRecord[] = [];
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

    this.metrics = initializeCanvasMetrics(canvas);

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

    const existingRecord = this.findSurfaceRecordByElement(element);
    if (existingRecord) {
      return existingRecord.surface;
    }

    const domState = snapshotSurfaceDomState(element);
    if (element.parentElement !== this.canvas) {
      this.canvas.appendChild(element);
    }

    const surface = new CanvasSurface(element, options);
    setSurfaceLifecycle(surface, {
      unregister: (target) => {
        this.unregisterSurfaceRecord(target);
      }
    });
    surface.element.style.position = "absolute";
    surface.element.style.left = "0";
    surface.element.style.top = "0";
    surface.element.style.transformOrigin = "0 0";
    setSurfaceInteractivity(surface, false);
    this.surfaces.push({ surface, domState });
    this.invalidate();
    return surface;
  }

  /**
   * Unregisters a surface and restores its original DOM ownership.
   *
   * @param surface - Surface returned by `registerSurface()`.
   */
  unregisterSurface(surface: CanvasSurface): void {
    surface.dispose();
  }

  private unregisterSurfaceRecord(surface: CanvasSurface): void {
    const index = this.surfaces.findIndex((record) => record.surface === surface);
    if (index === -1) {
      return;
    }

    const [record] = this.surfaces.splice(index, 1);
    if (!record) {
      return;
    }

    setSurfaceInteractivity(record.surface, false);
    restoreSurfaceDomState(record.surface.element, record.domState);
    this.invalidate();
  }

  /**
   * Converts viewport client coordinates into runtime CSS-pixel coordinates.
   *
   * @param clientX - Pointer or mouse X coordinate from a DOM event.
   * @param clientY - Pointer or mouse Y coordinate from a DOM event.
   * @returns A point relative to the runtime canvas in CSS pixels.
   */
  clientToCanvasPoint(clientX: number, clientY: number): CanvasPoint {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  /**
   * Converts a CSS-pixel length to backing-store pixels.
   *
   * @param length - Length in CSS pixels.
   * @returns The equivalent backing-store pixel length.
   */
  cssLengthToCanvasPixels(length: number): number {
    return length * this.metrics.pixelRatio;
  }

  /**
   * Converts a CSS-pixel point to backing-store pixels.
   *
   * @param point - Point in runtime CSS-pixel coordinates.
   * @returns The equivalent point in backing-store pixels.
   */
  cssPointToCanvasPixels(point: CanvasPoint): CanvasPoint {
    const scaleX = this.width > 0 ? this.canvas.width / this.width : this.metrics.pixelRatio;
    const scaleY = this.height > 0 ? this.canvas.height / this.height : this.metrics.pixelRatio;
    return {
      x: point.x * scaleX,
      y: point.y * scaleY
    };
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
    for (const record of [...this.surfaces]) {
      record.surface.dispose();
    }
    this.updateHandlers.length = 0;
    this.paintHandlers.length = 0;
  }

  private flushPaint(): void {
    this.pendingPaint = false;
    this.ctx.reset();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const record of this.surfaces) {
      setSurfaceInteractivity(record.surface, false);
    }

    const drawSurface = (surface: CanvasSurface): void => {
      assertRegisteredSurface(this.surfaces, surface);
      const cssBounds = surface.getBounds();
      const pixelBounds = this.cssRectToCanvasPixels(cssBounds);
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

  private cssRectToCanvasPixels(bounds: RectLike): Rect {
    const scaleX = this.width > 0 ? this.canvas.width / this.width : 1;
    const scaleY = this.height > 0 ? this.canvas.height / this.height : 1;
    return new Rect(
      bounds.x * scaleX,
      bounds.y * scaleY,
      bounds.width * scaleX,
      bounds.height * scaleY
    );
  }

  private findSurfaceRecordByElement(element: HTMLElement): SurfaceRecord | undefined {
    return this.surfaces.find((record) => record.surface.element === element);
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

  return new FallbackCanvasBackend(() => canvas.ownerDocument.createElement("canvas"));
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
  surfaces: readonly SurfaceRecord[],
  surface: CanvasSurface
): void {
  if (!surfaces.some((record) => record.surface === surface)) {
    throw new Error("Prism CanvasRuntime can only draw surfaces registered with this runtime.");
  }
}

function snapshotSurfaceDomState(element: HTMLElement): SurfaceDomState {
  const inertElement = element as HTMLElement & { inert?: boolean };
  return {
    parent: element.parentNode,
    nextSibling: element.nextSibling,
    style: element.getAttribute("style"),
    ariaLabel: element.getAttribute("aria-label"),
    prismSurface: element.getAttribute("data-prism-surface"),
    inert: "inert" in inertElement ? inertElement.inert : undefined
  };
}

function restoreSurfaceDomState(element: HTMLElement, state: SurfaceDomState): void {
  restoreAttribute(element, "style", state.style);
  restoreAttribute(element, "aria-label", state.ariaLabel);
  restoreAttribute(element, "data-prism-surface", state.prismSurface);

  const inertElement = element as HTMLElement & { inert?: boolean };
  if (state.inert === undefined) {
    if ("inert" in inertElement) {
      inertElement.inert = false;
    }
  } else {
    inertElement.inert = state.inert;
  }

  if (state.parent) {
    state.parent.insertBefore(
      element,
      state.nextSibling?.parentNode === state.parent ? state.nextSibling : null
    );
  } else {
    element.remove();
  }
}

function restoreAttribute(
  element: HTMLElement,
  name: string,
  value: string | null
): void {
  if (value === null) {
    element.removeAttribute(name);
    return;
  }

  element.setAttribute(name, value);
}

function initializeCanvasMetrics(canvas: HTMLCanvasElement): CanvasMetrics {
  return resizeCanvasToDisplaySize(canvas);
}
