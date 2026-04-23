/**
 * Readonly two-dimensional vector shape.
 */
export type Vec2Like = Readonly<{
  /**
   * X component.
   */
  x: number;

  /**
   * Y component.
   */
  y: number;
}>;

/**
 * Immutable two-dimensional vector.
 */
export class Vec2 {
  /**
   * X component.
   */
  readonly x: number;

  /**
   * Y component.
   */
  readonly y: number;

  /**
   * Creates a vector.
   *
   * @param x - X component.
   * @param y - Y component.
   */
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  /**
   * Zero vector.
   */
  static readonly zero = new Vec2(0, 0);

  /**
   * Adds another vector.
   *
   * @param other - Vector to add.
   * @returns The summed vector.
   */
  add(other: Vec2Like): Vec2 {
    return new Vec2(this.x + other.x, this.y + other.y);
  }

  /**
   * Subtracts another vector.
   *
   * @param other - Vector to subtract.
   * @returns The difference vector.
   */
  subtract(other: Vec2Like): Vec2 {
    return new Vec2(this.x - other.x, this.y - other.y);
  }

  /**
   * Multiplies both components by a scalar.
   *
   * @param value - Scalar multiplier.
   * @returns The scaled vector.
   */
  scale(value: number): Vec2 {
    return new Vec2(this.x * value, this.y * value);
  }

  /**
   * Computes the vector magnitude.
   *
   * @returns Euclidean length.
   */
  length(): number {
    return Math.hypot(this.x, this.y);
  }
}
