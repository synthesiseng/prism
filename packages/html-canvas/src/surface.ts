import { Rect, type RectLike } from "@prism/math";

export type SurfaceBoundsInput = RectLike | (() => RectLike);

export type SurfaceOptions = Readonly<{
  bounds: SurfaceBoundsInput;
  ariaLabel?: string;
}>;

export class CanvasSurface {
  readonly element: HTMLElement;
  private readonly getBoundsValue: () => RectLike;

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

  getBounds(): Rect {
    const bounds = this.getBoundsValue();
    return new Rect(bounds.x, bounds.y, bounds.width, bounds.height);
  }
}
