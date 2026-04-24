import { Rect, type RectLike } from "@prism/math";

/**
 * Describes a surface rectangle in runtime CSS pixels.
 *
 * @remarks
 * This is the public coordinate space for surfaces. Prism converts these bounds
 * to canvas backing-store pixels when drawing. Use `CanvasSurface.setBounds()`
 * when application state moves or resizes a surface after registration.
 */
export type SurfaceBoundsInput = RectLike | (() => RectLike);

/**
 * Configures an HTML surface registered with a runtime.
 */
export type SurfaceOptions = Readonly<{
  /**
   * Initial surface bounds in runtime CSS pixels.
   *
   * @remarks
   * Use `CanvasSurface.setBounds()` after registration when bounds change.
   */
  bounds: SurfaceBoundsInput;

  /**
   * Accessible label applied while the surface is runtime-managed.
   */
  ariaLabel?: string;
}>;

type SurfaceLifecycle = Readonly<{
  invalidate(): void;
  unregister(surface: CanvasSurface): void;
}>;

const surfaceLifecycles = new WeakMap<CanvasSurface, SurfaceLifecycle>();

/**
 * Represents a runtime-managed HTML surface.
 *
 * @remarks
 * Surfaces are created by `CanvasRuntime.registerSurface()`. Disposing a
 * surface unregisters it from the runtime and restores the element's original
 * DOM ownership. Surface bounds are expressed in runtime CSS pixels.
 */
export class CanvasSurface {
  /**
   * HTML element represented by this surface.
   */
  readonly element: HTMLElement;
  private boundsInput: SurfaceBoundsInput;
  private disposed = false;

  /**
   * Creates a surface wrapper for an element.
   *
   * @param element - HTML element represented by the surface.
   * @param options - Surface configuration.
   */
  constructor(element: HTMLElement, options: SurfaceOptions) {
    this.element = element;
    this.boundsInput = options.bounds;

    if (options.ariaLabel) {
      this.element.setAttribute("aria-label", options.ariaLabel);
    }
    this.element.dataset.prismSurface = "true";
  }

  /**
   * Whether this surface has been disposed.
   */
  get isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Reads the current surface bounds.
   *
   * @returns The current bounds in runtime CSS pixels.
   *
   * @throws Error when the surface has already been disposed.
   */
  getBounds(): Rect {
    if (this.disposed) {
      throw new Error("Cannot read bounds from a disposed Prism canvas surface.");
    }

    const bounds = typeof this.boundsInput === "function"
      ? this.boundsInput()
      : this.boundsInput;
    return new Rect(bounds.x, bounds.y, bounds.width, bounds.height);
  }

  /**
   * Updates the surface bounds in runtime CSS pixels.
   *
   * @remarks
   * Use this when application state moves or resizes a surface after
   * registration. Prism converts these CSS-pixel bounds to backing-store pixels
   * during painting. Calling this outside an active paint pass schedules a
   * runtime repaint.
   *
   * @param bounds - New surface bounds in runtime CSS pixels.
   *
   * @throws Error when the surface has already been disposed.
   */
  setBounds(bounds: RectLike): void {
    if (this.disposed) {
      throw new Error("Cannot update bounds on a disposed Prism canvas surface.");
    }

    this.boundsInput = bounds;
    surfaceLifecycles.get(this)?.invalidate();
  }

  /**
   * Unregisters the surface from its runtime.
   *
   * @remarks
   * Calling `dispose()` more than once is safe.
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    surfaceLifecycles.get(this)?.unregister(this);
  }
}

/**
 * Connects a surface to runtime-owned lifecycle behavior.
 *
 * @internal
 */
export function setSurfaceLifecycle(
  surface: CanvasSurface,
  lifecycle: SurfaceLifecycle
): void {
  surfaceLifecycles.set(surface, lifecycle);
}
