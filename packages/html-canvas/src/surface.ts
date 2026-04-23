import { Rect, type RectLike } from "@prism/math";

export type SurfaceBoundsInput = RectLike | (() => RectLike);

export type SurfaceOptions = Readonly<{
  bounds: SurfaceBoundsInput;
  ariaLabel?: string;
}>;

type SurfaceLifecycle = Readonly<{
  unregister(surface: CanvasSurface): void;
}>;

const surfaceLifecycles = new WeakMap<CanvasSurface, SurfaceLifecycle>();

export class CanvasSurface {
  readonly element: HTMLElement;
  private readonly getBoundsValue: () => RectLike;
  private disposed = false;

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

  get isDisposed(): boolean {
    return this.disposed;
  }

  getBounds(): Rect {
    if (this.disposed) {
      throw new Error("Cannot read bounds from a disposed Prism canvas surface.");
    }

    const bounds = this.getBoundsValue();
    return new Rect(bounds.x, bounds.y, bounds.width, bounds.height);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    surfaceLifecycles.get(this)?.unregister(this);
  }
}

export function setSurfaceLifecycle(
  surface: CanvasSurface,
  lifecycle: SurfaceLifecycle
): void {
  surfaceLifecycles.set(surface, lifecycle);
}
