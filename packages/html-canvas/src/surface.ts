import { Rect, type RectLike } from "@prism/math";

/**
 * Describes a surface rectangle in runtime CSS pixels.
 *
 * @remarks
 * A function can be used when bounds are driven by mutable application state.
 */
export type SurfaceBoundsInput = RectLike | (() => RectLike);

/**
 * Configures an HTML surface registered with a runtime.
 */
export type SurfaceOptions = Readonly<{
  /**
   * Surface bounds in runtime CSS pixels.
   */
  bounds: SurfaceBoundsInput;

  /**
   * Accessible label applied while the surface is runtime-managed.
   */
  ariaLabel?: string;
}>;

type SurfaceLifecycle = Readonly<{
  unregister(surface: CanvasSurface): void;
}>;

const surfaceLifecycles = new WeakMap<CanvasSurface, SurfaceLifecycle>();

/**
 * Represents a runtime-managed HTML surface.
 *
 * @remarks
 * Surfaces are created by `CanvasRuntime.registerSurface()`. Disposing a
 * surface unregisters it from the runtime and restores the element's original
 * DOM ownership.
 */
export class CanvasSurface {
  /**
   * HTML element represented by this surface.
   */
  readonly element: HTMLElement;
  private readonly getBoundsValue: () => RectLike;
  private disposed = false;

  /**
   * Creates a surface wrapper for an element.
   *
   * @param element - HTML element represented by the surface.
   * @param options - Surface configuration.
   */
  constructor(element: HTMLElement, options: SurfaceOptions) {
    this.element = element;
    const boundsInput = options.bounds;
    this.getBoundsValue =
      typeof boundsInput === "function" ? boundsInput : () => boundsInput;

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

    const bounds = this.getBoundsValue();
    return new Rect(bounds.x, bounds.y, bounds.width, bounds.height);
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
