import { Rect, type RectLike } from "@prism/math";
import type { TextureHandle } from "@prism/renderer";
import { CanvasDomTextureAdapter } from "./canvas-dom-texture-adapter";
import type { DomSurfaceOptions, DomSurfaceRenderer, DomTextureAdapter } from "./types";

export class DomSurface {
  readonly element: HTMLElement;
  private readonly adapter: DomTextureAdapter;
  private texture: TextureHandle | undefined;
  private bounds: Rect;

  constructor(
    element: HTMLElement,
    options: DomSurfaceOptions,
    adapter: DomTextureAdapter = new CanvasDomTextureAdapter()
  ) {
    this.element = element;
    this.bounds = new Rect(
      options.bounds.x,
      options.bounds.y,
      options.bounds.width,
      options.bounds.height
    );
    this.adapter = adapter;

    if (options.ariaLabel) {
      this.element.setAttribute("aria-label", options.ariaLabel);
    }
    this.element.dataset.prismSurface = "true";
  }

  setBounds(bounds: RectLike): void {
    this.bounds = new Rect(bounds.x, bounds.y, bounds.width, bounds.height);
  }

  render(renderer: DomSurfaceRenderer): void {
    const pixelRatio = globalThis.devicePixelRatio || 1;
    this.syncDomFallback(pixelRatio);
    const captured = this.adapter.capture({
      element: this.element,
      bounds: this.bounds,
      pixelRatio
    });
    this.texture = renderer.updateTexture(captured.source, this.texture);
    renderer.drawQuad({
      rect: {
        x: this.bounds.x * pixelRatio,
        y: this.bounds.y * pixelRatio,
        width: this.bounds.width * pixelRatio,
        height: this.bounds.height * pixelRatio
      },
      texture: this.texture
    });
  }

  private syncDomFallback(pixelRatio: number): void {
    this.element.style.position = "absolute";
    this.element.style.left = "0";
    this.element.style.top = "0";
    this.element.style.width = `${String(this.bounds.width)}px`;
    this.element.style.height = `${String(this.bounds.height)}px`;
    this.element.style.transform = `translate3d(${String(this.bounds.x)}px, ${String(
      this.bounds.y
    )}px, 0)`;
    this.element.style.transformOrigin = "0 0";
    this.element.style.pointerEvents = "auto";
    this.element.style.setProperty("--prism-device-pixel-ratio", String(pixelRatio));
  }
}
