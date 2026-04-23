import type { Vec2Like } from "./vec2";

export type RectLike = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export class Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;

  constructor(x: number, y: number, width: number, height: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  static fromSize(width: number, height: number): Rect {
    return new Rect(0, 0, width, height);
  }

  get right(): number {
    return this.x + this.width;
  }

  get bottom(): number {
    return this.y + this.height;
  }

  contains(point: Vec2Like): boolean {
    return (
      point.x >= this.x &&
      point.x <= this.right &&
      point.y >= this.y &&
      point.y <= this.bottom
    );
  }

  translate(offset: Vec2Like): Rect {
    return new Rect(this.x + offset.x, this.y + offset.y, this.width, this.height);
  }
}
