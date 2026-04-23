import type { RectLike } from "@prism/math";
import type { QuadOptions, TextureHandle } from "@prism/renderer";

export type DomSurfaceOptions = Readonly<{
  bounds: RectLike;
  ariaLabel?: string;
}>;

export interface DomTextureAdapter {
  capture(surface: DomSurfaceSnapshot): CapturedUiSurface;
}

export type DomSurfaceSnapshot = Readonly<{
  element: HTMLElement;
  bounds: RectLike;
  pixelRatio: number;
}>;

export type CapturedUiSurface = Readonly<{
  width: number;
  height: number;
  revision: number;
  source: CanvasImageSource;
}>;

export interface DomSurfaceRenderer {
  readonly width: number;
  readonly height: number;
  updateTexture(source: CanvasImageSource, handle?: TextureHandle): TextureHandle;
  drawQuad(options: QuadOptions): void;
}
