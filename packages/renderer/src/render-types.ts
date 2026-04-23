import type { RectLike } from "@prism/math";

export type Rgba = readonly [number, number, number, number];

export type TextureHandle = Readonly<{
  id: number;
  width: number;
  height: number;
}>;

export type QuadOptions = Readonly<{
  rect: RectLike;
  color?: Rgba;
  texture?: TextureHandle;
  opacity?: number;
}>;

export interface Renderer2D {
  readonly canvas: HTMLCanvasElement;
  readonly width: number;
  readonly height: number;
  beginFrame(clearColor: Rgba): void;
  drawQuad(options: QuadOptions): void;
}
