import type { Vec2Like } from "./vec2";

/**
 * Readonly rectangle shape.
 */
export type RectLike = Readonly<{
  /**
   * Left coordinate.
   */
  x: number;

  /**
   * Top coordinate.
   */
  y: number;

  /**
   * Rectangle width.
   */
  width: number;

  /**
   * Rectangle height.
   */
  height: number;
}>;

/**
 * Immutable axis-aligned rectangle.
 *
 * @remarks
 * Prism uses rectangles for CSS-pixel bounds and backing-store pixel bounds.
 * The coordinate space is defined by the caller.
 */
export class Rect {
  /**
   * Left coordinate.
   */
  readonly x: number;

  /**
   * Top coordinate.
   */
  readonly y: number;

  /**
   * Rectangle width.
   */
  readonly width: number;

  /**
   * Rectangle height.
   */
  readonly height: number;

  /**
   * Creates a rectangle.
   *
   * @param x - Left coordinate.
   * @param y - Top coordinate.
   * @param width - Rectangle width.
   * @param height - Rectangle height.
   */
  constructor(x: number, y: number, width: number, height: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  /**
   * Creates a rectangle at the origin.
   *
   * @param width - Rectangle width.
   * @param height - Rectangle height.
   * @returns A rectangle with `x` and `y` set to zero.
   */
  static fromSize(width: number, height: number): Rect {
    return new Rect(0, 0, width, height);
  }

  /**
   * Right edge coordinate.
   */
  get right(): number {
    return this.x + this.width;
  }

  /**
   * Bottom edge coordinate.
   */
  get bottom(): number {
    return this.y + this.height;
  }

  /**
   * Checks whether a point lies inside the rectangle.
   *
   * @param point - Point to test.
   * @returns `true` when the point is inside or on the rectangle edge.
   */
  contains(point: Vec2Like): boolean {
    return (
      point.x >= this.x &&
      point.x <= this.right &&
      point.y >= this.y &&
      point.y <= this.bottom
    );
  }

  /**
   * Translates the rectangle.
   *
   * @param offset - Offset to apply.
   * @returns A translated rectangle with the same size.
   */
  translate(offset: Vec2Like): Rect {
    return new Rect(this.x + offset.x, this.y + offset.y, this.width, this.height);
  }
}
